<?php
/**
 * Impor data program ke database baru. Hanya lewat CLI.
 *
 *   php api/tools/import-programs.php [--from=json|supabase] [--file=PATH] [--supabase-url=URL]
 *                                     [--supabase-key=KUNCI_ANON] [--copy-images] [--sql=OUT.sql] [--dry-run]
 *
 * Sumber data:
 *   --from=json      (bawaan) assets/data/programs.json, atau --file=PATH
 *   --from=supabase  baca langsung dari REST publik Supabase lama (hanya GET, tanpa kunci rahasia).
 *                    URL & kunci publik (anon) diambil dari --supabase-url / --supabase-key,
 *                    atau dari database/legacy/supabase-config.js bila file itu ada.
 *
 * Keluaran:
 *   (bawaan)   menulis ke database sesuai api/config.php (upsert: id yang sama diperbarui)
 *   --sql=OUT  tidak menyentuh database; tulis file .sql untuk diimpor lewat phpMyAdmin
 *   --dry-run  hanya validasi dan tampilkan ringkasan
 *
 * --copy-images  unduh gambar banner yang masih di Supabase Storage, unggah ke storage baru
 *                (sesuai storage.driver di konfigurasi), dan ganti URL-nya.
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/programs.php';

$opts = [];
foreach (array_slice($argv, 1) as $a) {
    if (preg_match('/^--([a-z-]+)(?:=(.*))?$/', $a, $m)) {
        $opts[$m[1]] = $m[2] ?? true;
    }
}
$from = $opts['from'] ?? 'json';
$sqlOut = is_string($opts['sql'] ?? null) ? $opts['sql'] : null;
$dryRun = isset($opts['dry-run']);
$copyImages = isset($opts['copy-images']);

function http_get(string $url, array $headers = []): string
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 3,
        CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 60, CURLOPT_HTTPHEADER => $headers,
    ]);
    $body = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $err = curl_error($ch);
    if (!is_string($body) || $status < 200 || $status >= 300) {
        throw new RuntimeException("GET $url gagal (HTTP $status) $err");
    }
    return $body;
}

// ─── 1. Ambil data mentah ───
if ($from === 'supabase') {
    $url = is_string($opts['supabase-url'] ?? null) ? $opts['supabase-url'] : '';
    $key = is_string($opts['supabase-key'] ?? null) ? $opts['supabase-key'] : '';
    $legacy = RUAI_SITE_DIR . '/database/legacy/supabase-config.js';
    if (is_file($legacy)) {
        $js = (string) file_get_contents($legacy);
        if ($url === '' && preg_match('/url:\s*"([^"]+)"/', $js, $m)) {
            $url = $m[1];
        }
        if (preg_match('/anonKey:\s*"([^"]+)"/', $js, $m)) {
            $key = $m[1];
        }
    }
    if ($url === '') {
        fwrite(STDERR, "URL Supabase tidak ditemukan. Gunakan --supabase-url=https://xxxx.supabase.co\n");
        exit(1);
    }
    $url = rtrim($url, '/');
    $headers = $key !== '' ? ["apikey: $key", "Authorization: Bearer $key"] : [];
    $raw = http_get($url . '/rest/v1/programs?select=*&order=created_at.desc', $headers);
    $supabaseHost = parse_url($url, PHP_URL_HOST);
} else {
    $file = is_string($opts['file'] ?? null) ? $opts['file'] : RUAI_SITE_DIR . '/assets/data/programs.json';
    if (!is_file($file)) {
        fwrite(STDERR, "File tidak ditemukan: $file\n");
        exit(1);
    }
    $raw = (string) file_get_contents($file);
    $supabaseHost = null;
}

$rows = json_decode($raw, true);
if (!is_array($rows) || !is_list_array($rows)) {
    fwrite(STDERR, "Data sumber bukan daftar program yang valid.\n");
    exit(1);
}

// ─── 2. Validasi (+ salin gambar bila diminta) ───
$clean = [];
$problems = 0;
foreach ($rows as $i => $row) {
    if (!is_array($row)) {
        fwrite(STDERR, "Baris #$i bukan objek, dilewati.\n");
        $problems++;
        continue;
    }
    // programs.json memakai "schedule"; Supabase/DB memakai "schedule_json"
    if (!array_key_exists('schedule_json', $row) && array_key_exists('schedule', $row)) {
        $row['schedule_json'] = $row['schedule'];
    }
    unset($row['schedule']);
    $createdAt = $row['created_at'] ?? null;
    $updatedAt = $row['updated_at'] ?? null;
    $row = array_intersect_key($row, array_flip(PROGRAM_COLUMNS));

    // Data lama sering memakai '' untuk "kosong"; validator akan mengubahnya menjadi NULL.
    [$data, $errors] = program_validate($row, true);
    if ($errors) {
        $problems++;
        fwrite(STDERR, 'Program "' . ($row['id'] ?? "#$i") . '" ditolak: ' . json_encode($errors, JSON_UNESCAPED_UNICODE) . "\n");
        continue;
    }

    if ($copyImages && $supabaseHost && !empty($data['thumbnail_url'])
        && parse_url($data['thumbnail_url'], PHP_URL_HOST) === $supabaseHost) {
        require_once __DIR__ . '/../lib/storage.php';
        try {
            $bytes = http_get($data['thumbnail_url']);
            $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
            $ext = ['image/webp' => 'webp', 'image/jpeg' => 'jpg', 'image/png' => 'png'][$mime] ?? null;
            if ($ext === null) {
                throw new RuntimeException("tipe $mime tidak didukung");
            }
            $base = preg_replace('/[^a-z0-9]+/', '-', strtolower(pathinfo(parse_url($data['thumbnail_url'], PHP_URL_PATH), PATHINFO_FILENAME)));
            $key = 'banners/' . trim(substr($base, 0, 40), '-') . '-' . substr(sha1($bytes), 0, 8) . '.' . $ext;
            if (!$dryRun) {
                $data['thumbnail_url'] = storage()->put($key, $bytes, $mime);
            }
            echo "  gambar disalin: {$data['id']} → $key\n";
        } catch (Throwable $e) {
            $problems++;
            fwrite(STDERR, "  gambar {$data['id']} gagal disalin (URL lama dipertahankan): " . $e->getMessage() . "\n");
        }
    }

    // Pertahankan stempel waktu asli bila ada (untuk urutan daftar yang sama).
    foreach (['created_at' => $createdAt, 'updated_at' => $updatedAt] as $col => $value) {
        if (is_string($value) && $value !== '') {
            try {
                $data[$col] = (new DateTimeImmutable($value))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.v');
            } catch (Throwable $e) {
                // stempel waktu tidak terbaca: biarkan DB mengisi otomatis
            }
        }
    }
    $clean[] = $data;
}

echo count($rows) . ' program dibaca, ' . count($clean) . " lolos validasi, $problems masalah.\n";
if ($dryRun) {
    exit($problems ? 2 : 0);
}

// ─── 3. Tulis ───
if ($sqlOut !== null) {
    $q = static function ($v): string {
        if ($v === null) {
            return 'NULL';
        }
        if (is_int($v)) {
            return (string) $v;
        }
        return "'" . strtr((string) $v, ["\\" => "\\\\", "'" => "''", "\0" => '\\0', "\n" => '\\n', "\r" => '\\r', "\x1a" => '\\Z']) . "'";
    };
    $sql = "-- Data program Ruai TV (dibuat " . gmdate('Y-m-d H:i') . " UTC oleh api/tools/import-programs.php)\n"
        . "-- Impor lewat phpMyAdmin SETELAH database/mariadb_schema.sql. Id yang sama akan diperbarui.\n"
        . "SET NAMES utf8mb4;\nSET time_zone = '+00:00';\n\n";
    foreach ($clean as $data) {
        $cols = array_keys($data);
        $updates = [];
        foreach ($cols as $c) {
            if ($c !== 'id' && $c !== 'created_at') {
                $updates[] = "`$c` = VALUES(`$c`)";
            }
        }
        $sql .= 'INSERT INTO programs (`' . implode('`, `', $cols) . '`) VALUES ('
            . implode(', ', array_map($q, array_values($data))) . ")\n  ON DUPLICATE KEY UPDATE " . implode(', ', $updates) . ";\n";
    }
    file_put_contents($sqlOut, $sql);
    echo "File SQL ditulis: $sqlOut\n";
} else {
    $pdo = db();
    $pdo->beginTransaction();
    try {
        foreach ($clean as $data) {
            $cols = array_keys($data);
            $updates = [];
            foreach ($cols as $c) {
                if ($c !== 'id' && $c !== 'created_at') {
                    $updates[] = "`$c` = VALUES(`$c`)";
                }
            }
            $pdo->prepare('INSERT INTO programs (`' . implode('`, `', $cols) . '`) VALUES (' . implode(', ', array_fill(0, count($cols), '?')) . ') ON DUPLICATE KEY UPDATE ' . implode(', ', $updates))
                ->execute(array_values($data));
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    echo count($clean) . " program ditulis ke database.\n";
}
exit($problems ? 2 : 0);
