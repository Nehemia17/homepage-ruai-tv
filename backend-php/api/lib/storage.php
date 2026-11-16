<?php
/**
 * RUAI TV API — penyimpanan file banner.
 *   - S3Storage    : bucket S3-kompatibel (IDCloudHost Object Storage), tanda tangan AWS SigV4 via cURL
 *   - LocalStorage : folder uploads/ (khusus pengembangan lokal)
 * Kunci akses bucket hanya dibaca dari konfigurasi server, tidak pernah dikirim ke browser.
 */
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function storage_assert_key(string $key): void
{
    if ($key === '' || strlen($key) > 200 || preg_match('#^[a-z0-9][a-z0-9/_.-]*$#', $key) !== 1
        || str_contains($key, '..') || str_contains($key, '//')) {
        throw new InvalidArgumentException('Kunci file penyimpanan tidak valid.');
    }
}

/** @return S3Storage|LocalStorage */
function storage()
{
    static $instance = null;
    if ($instance !== null) {
        return $instance;
    }
    $cfg = ruai_config()['storage'];
    $instance = match ($cfg['driver']) {
        's3' => new S3Storage($cfg['s3']),
        'local' => new LocalStorage($cfg['local']),
        default => throw new RuntimeException('storage.driver harus "s3" atau "local".'),
    };
    return $instance;
}

final class LocalStorage
{
    private string $dir;
    private string $publicBase;

    public function __construct(array $cfg)
    {
        $this->dir = rtrim((string) ($cfg['dir'] ?: RUAI_SITE_DIR . '/uploads'), '/\\');
        $this->publicBase = rtrim((string) $cfg['public_base_url'], '/');
    }

    public function driver(): string
    {
        return 'local';
    }

    public function publicUrl(string $key): string
    {
        return $this->publicBase . '/' . $key;
    }

    public function put(string $key, string $body, string $contentType): string
    {
        storage_assert_key($key);
        $path = $this->dir . '/' . $key;
        $parent = dirname($path);
        if (!is_dir($parent) && !mkdir($parent, 0755, true) && !is_dir($parent)) {
            throw new RuntimeException('Folder penyimpanan lokal tidak bisa dibuat.');
        }
        if (file_put_contents($path, $body, LOCK_EX) === false) {
            throw new RuntimeException('Gagal menulis file ke penyimpanan lokal.');
        }
        return $this->publicUrl($key);
    }

    public function delete(string $key): void
    {
        storage_assert_key($key);
        $path = $this->dir . '/' . $key;
        if (is_file($path)) {
            unlink($path);
        }
    }

    public function check(): array
    {
        $t0 = microtime(true);
        $ok = is_dir($this->dir) ? is_writable($this->dir) : is_writable(dirname($this->dir));
        return [
            'ok' => $ok,
            'ms' => (int) round((microtime(true) - $t0) * 1000),
            'detail' => $ok ? 'Folder penyimpanan lokal dapat ditulis.' : 'Folder penyimpanan lokal tidak dapat ditulis.',
        ];
    }

    public function info(): array
    {
        return ['driver' => 'local', 'bucket' => null, 'endpoint_host' => null, 'public_base_url' => $this->publicBase];
    }
}

final class S3Storage
{
    private array $c;

    public function __construct(array $cfg)
    {
        foreach (['endpoint', 'bucket', 'access_key', 'secret_key', 'public_base_url'] as $k) {
            if (trim((string) ($cfg[$k] ?? '')) === '') {
                throw new RuntimeException("Konfigurasi storage.s3.$k belum diisi.");
            }
        }
        if (str_contains((string) $cfg['endpoint'], 'GANTI') || str_contains((string) $cfg['access_key'], 'GANTI')) {
            throw new RuntimeException('Konfigurasi storage.s3 masih berisi nilai contoh (GANTI...).');
        }
        $parts = parse_url(rtrim((string) $cfg['endpoint'], '/'));
        if (!is_array($parts) || empty($parts['host']) || !in_array($parts['scheme'] ?? '', ['http', 'https'], true)) {
            throw new RuntimeException('storage.s3.endpoint harus berupa URL http(s) yang valid.');
        }
        $cfg['_scheme'] = $parts['scheme'];
        $cfg['_host'] = $parts['host'];
        $defaultPort = $parts['scheme'] === 'https' ? 443 : 80;
        $cfg['_port'] = isset($parts['port']) && (int) $parts['port'] !== $defaultPort ? ':' . (int) $parts['port'] : '';
        $this->c = $cfg;
    }

    public function driver(): string
    {
        return 's3';
    }

    private static function encodeKey(string $key): string
    {
        return implode('/', array_map('rawurlencode', explode('/', $key)));
    }

    public function publicUrl(string $key): string
    {
        return rtrim((string) $this->c['public_base_url'], '/') . '/' . self::encodeKey($key);
    }

    /** @return array{0: string, 1: string, 2: string} [url, hostHeader, canonicalUri] */
    private function target(string $key): array
    {
        $pathStyle = (bool) ($this->c['path_style'] ?? true);
        $host = ($pathStyle ? '' : $this->c['bucket'] . '.') . $this->c['_host'] . $this->c['_port'];
        $uri = $pathStyle ? '/' . rawurlencode($this->c['bucket']) : '';
        if ($key !== '') {
            $uri .= '/' . self::encodeKey($key);
        }
        if ($uri === '') {
            $uri = '/';
        }
        return [$this->c['_scheme'] . '://' . $host . $uri, $host, $uri];
    }

    /**
     * Tanda tangan AWS Signature V4 (layanan s3). Fungsi murni agar bisa diuji dengan
     * contoh resmi dokumentasi AWS.
     *
     * @param array<string,string> $headers semua header yang ditandatangani (termasuk host, x-amz-date, x-amz-content-sha256)
     * @return array{signature: string, authorization: string, signed_headers: string}
     */
    public static function sign(
        string $method, string $canonicalUri, string $canonicalQuery, array $headers,
        string $payloadHash, string $amzDate, string $region, string $accessKey, string $secretKey
    ): array {
        $norm = [];
        foreach ($headers as $name => $value) {
            $norm[strtolower((string) $name)] = trim((string) preg_replace('/\s+/', ' ', (string) $value));
        }
        ksort($norm);
        $canonicalHeaders = '';
        foreach ($norm as $name => $value) {
            $canonicalHeaders .= $name . ':' . $value . "\n";
        }
        $signedHeaders = implode(';', array_keys($norm));

        $canonicalRequest = implode("\n", [
            $method, $canonicalUri, $canonicalQuery, $canonicalHeaders, $signedHeaders, $payloadHash,
        ]);

        $date = substr($amzDate, 0, 8);
        $scope = $date . '/' . $region . '/s3/aws4_request';
        $stringToSign = implode("\n", ['AWS4-HMAC-SHA256', $amzDate, $scope, hash('sha256', $canonicalRequest)]);

        $kDate = hash_hmac('sha256', $date, 'AWS4' . $secretKey, true);
        $kRegion = hash_hmac('sha256', $region, $kDate, true);
        $kService = hash_hmac('sha256', 's3', $kRegion, true);
        $kSigning = hash_hmac('sha256', 'aws4_request', $kService, true);
        $signature = hash_hmac('sha256', $stringToSign, $kSigning);

        return [
            'signature' => $signature,
            'signed_headers' => $signedHeaders,
            'authorization' => "AWS4-HMAC-SHA256 Credential=$accessKey/$scope, SignedHeaders=$signedHeaders, Signature=$signature",
        ];
    }

    /** @return array{status: int, body: string} */
    private function request(string $method, string $key, string $body = '', array $extraHeaders = []): array
    {
        [$url, $hostHeader, $canonicalUri] = $this->target($key);
        $amzDate = gmdate('Ymd\THis\Z');
        $payloadHash = hash('sha256', $body);

        $headers = ['host' => $hostHeader, 'x-amz-content-sha256' => $payloadHash, 'x-amz-date' => $amzDate];
        foreach ($extraHeaders as $name => $value) {
            $headers[strtolower($name)] = $value;
        }
        $signed = self::sign(
            $method, $canonicalUri, '', $headers, $payloadHash, $amzDate,
            (string) $this->c['region'], (string) $this->c['access_key'], (string) $this->c['secret_key']
        );

        $send = [];
        foreach ($headers as $name => $value) {
            if ($name !== 'host') {
                $send[] = $name . ': ' . $value;
            }
        }
        $send[] = 'Authorization: ' . $signed['authorization'];
        $send[] = 'Expect:';

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $send,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_TIMEOUT => 25,
        ]);
        if ($method === 'HEAD') {
            curl_setopt($ch, CURLOPT_NOBODY, true);
        } elseif ($method === 'PUT') {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }
        $response = curl_exec($ch);
        if ($response === false) {
            $err = curl_error($ch);
            throw new RuntimeException('Tidak dapat menghubungi storage: ' . $err);
        }
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        return ['status' => $status, 'body' => is_string($response) ? $response : ''];
    }

    private function fail(string $action, array $res): void
    {
        $code = preg_match('#<Code>([^<]+)</Code>#', $res['body'], $m) ? $m[1] : '';
        throw new RuntimeException("Storage menolak $action (HTTP {$res['status']}" . ($code !== '' ? ", $code" : '') . ').');
    }

    public function put(string $key, string $body, string $contentType): string
    {
        storage_assert_key($key);
        $extra = ['content-type' => $contentType, 'cache-control' => 'public, max-age=31536000, immutable'];
        $acl = trim((string) ($this->c['acl'] ?? ''));
        if ($acl !== '') {
            $extra['x-amz-acl'] = $acl;
        }
        $res = $this->request('PUT', $key, $body, $extra);
        if ($res['status'] < 200 || $res['status'] >= 300) {
            $this->fail('upload', $res);
        }
        return $this->publicUrl($key);
    }

    public function delete(string $key): void
    {
        storage_assert_key($key);
        $res = $this->request('DELETE', $key);
        if (($res['status'] < 200 || $res['status'] >= 300) && $res['status'] !== 404) {
            $this->fail('penghapusan', $res);
        }
    }

    /** Pemeriksaan baca-saja: HEAD bucket. */
    public function check(): array
    {
        $t0 = microtime(true);
        try {
            $res = $this->request('HEAD', '');
            $ms = (int) round((microtime(true) - $t0) * 1000);
            return match (true) {
                $res['status'] >= 200 && $res['status'] < 300 => ['ok' => true, 'ms' => $ms, 'detail' => 'Bucket dapat diakses dengan kunci yang dikonfigurasi.'],
                $res['status'] === 403 => ['ok' => false, 'ms' => $ms, 'detail' => 'Akses ditolak (403): periksa access key / secret key.'],
                $res['status'] === 404 => ['ok' => false, 'ms' => $ms, 'detail' => 'Bucket tidak ditemukan (404): periksa nama bucket dan endpoint.'],
                default => ['ok' => false, 'ms' => $ms, 'detail' => 'Respons tak terduga dari storage (HTTP ' . $res['status'] . ').'],
            };
        } catch (Throwable $e) {
            return ['ok' => false, 'ms' => (int) round((microtime(true) - $t0) * 1000), 'detail' => $e->getMessage()];
        }
    }

    public function info(): array
    {
        return [
            'driver' => 's3',
            'bucket' => $this->c['bucket'],
            'endpoint_host' => $this->c['_host'],
            'public_base_url' => rtrim((string) $this->c['public_base_url'], '/'),
        ];
    }
}
