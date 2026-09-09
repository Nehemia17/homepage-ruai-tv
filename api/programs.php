<?php
// ============================================================
// RUAI TV — Programs REST API Endpoint (api/programs.php)
// Methods: GET, POST, PUT, DELETE
// ============================================================

require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {

    // ─── GET: Fetch Programs ───
    case 'GET':
        if (isset($_GET['id']) && !empty($_GET['id'])) {
            $stmt = $pdo->prepare("SELECT * FROM programs WHERE id = ?");
            $stmt->execute([$_GET['id']]);
            $prog = $stmt->fetch();

            if ($prog) {
                $prog['schedule'] = !empty($prog['schedule_json']) ? json_decode($prog['schedule_json'], true) : null;
                unset($prog['schedule_json']);
                echo json_encode($prog);
            } else {
                http_response_code(404);
                echo json_encode(["status" => "error", "message" => "Program tidak ditemukan."]);
            }
        } else {
            $sql = "SELECT * FROM programs ORDER BY status ASC, created_at DESC";
            $stmt = $pdo->query($sql);
            $rows = $stmt->fetchAll();

            foreach ($rows as &$r) {
                $r['schedule'] = !empty($r['schedule_json']) ? json_decode($r['schedule_json'], true) : null;
                unset($r['schedule_json']);
            }

            echo json_encode($rows);
        }
        break;

    // ─── POST: Add New Program ───
    case 'POST':
        $data = json_decode(file_get_contents("php://input"), true);

        if (!$data || empty($data['title'])) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Judul program wajib diisi."]);
            exit();
        }

        $id = !empty($data['id']) ? $data['id'] : (!empty($data['slug']) ? $data['slug'] : 'prog-' . time());
        $title = $data['title'];
        $slug = !empty($data['slug']) ? $data['slug'] : strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $title)));
        $category = !empty($data['category']) ? $data['category'] : 'berita';
        $category_label = !empty($data['category_label']) ? $data['category_label'] : ($category === 'berita' ? 'Program Berita' : ($category === 'non-news' ? 'Non-News' : 'Kerja Sama'));
        $status = !empty($data['status']) ? $data['status'] : 'aktif';
        $format = !empty($data['format']) ? $data['format'] : '—';
        $duration = !empty($data['duration']) ? $data['duration'] : '—';
        $description = !empty($data['description']) ? $data['description'] : '';
        $thumbnail_url = !empty($data['thumbnail_url']) ? $data['thumbnail_url'] : null;
        $promo_video_url = !empty($data['promo_video_url']) ? $data['promo_video_url'] : null;
        $youtube_live_url = !empty($data['youtube_live_url']) ? $data['youtube_live_url'] : 'https://www.youtube.com/@ruaitv/live';
        $schedule_json = isset($data['schedule']) ? json_encode($data['schedule'], JSON_UNESCAPED_UNICODE) : null;
        $featured = isset($data['featured']) && $data['featured'] ? 1 : 0;

        $stmt = $pdo->prepare("INSERT INTO programs 
            (id, title, slug, category, category_label, status, format, duration, description, thumbnail_url, promo_video_url, youtube_live_url, schedule_json, featured) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

        try {
            $stmt->execute([$id, $title, $slug, $category, $category_label, $status, $format, $duration, $description, $thumbnail_url, $promo_video_url, $youtube_live_url, $schedule_json, $featured]);
            http_response_code(201);
            echo json_encode(["status" => "success", "message" => "Program berhasil ditambahkan.", "id" => $id]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Gagal menambahkan program: " . $e->getMessage()]);
        }
        break;

    // ─── PUT: Update Program ───
    case 'PUT':
        $data = json_decode(file_get_contents("php://input"), true);

        if (!$data || empty($data['id'])) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "ID program wajib diisi untuk update."]);
            exit();
        }

        $id = $data['id'];
        $title = $data['title'];
        $slug = !empty($data['slug']) ? $data['slug'] : $id;
        $category = !empty($data['category']) ? $data['category'] : 'berita';
        $category_label = !empty($data['category_label']) ? $data['category_label'] : ($category === 'berita' ? 'Program Berita' : ($category === 'non-news' ? 'Non-News' : 'Kerja Sama'));
        $status = !empty($data['status']) ? $data['status'] : 'aktif';
        $format = !empty($data['format']) ? $data['format'] : '—';
        $duration = !empty($data['duration']) ? $data['duration'] : '—';
        $description = !empty($data['description']) ? $data['description'] : '';
        $thumbnail_url = !empty($data['thumbnail_url']) ? $data['thumbnail_url'] : null;
        $promo_video_url = isset($data['promo_video_url']) ? $data['promo_video_url'] : null;
        $youtube_live_url = !empty($data['youtube_live_url']) ? $data['youtube_live_url'] : 'https://www.youtube.com/@ruaitv/live';
        $schedule_json = isset($data['schedule']) ? json_encode($data['schedule'], JSON_UNESCAPED_UNICODE) : null;
        $featured = isset($data['featured']) && $data['featured'] ? 1 : 0;

        $stmt = $pdo->prepare("UPDATE programs SET 
            title = ?, slug = ?, category = ?, category_label = ?, status = ?, format = ?, duration = ?, 
            description = ?, thumbnail_url = ?, promo_video_url = ?, youtube_live_url = ?, schedule_json = ?, featured = ? 
            WHERE id = ?");

        try {
            $stmt->execute([$title, $slug, $category, $category_label, $status, $format, $duration, $description, $thumbnail_url, $promo_video_url, $youtube_live_url, $schedule_json, $featured, $id]);
            echo json_encode(["status" => "success", "message" => "Program berhasil diperbarui.", "id" => $id]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Gagal merubah program: " . $e->getMessage()]);
        }
        break;

    // ─── DELETE: Delete Program ───
    case 'DELETE':
        $data = json_decode(file_get_contents("php://input"), true);
        $id = isset($_GET['id']) ? $_GET['id'] : (isset($data['id']) ? $data['id'] : null);

        if (!$id) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "ID program wajib dispesifikasikan untuk menghapus."]);
            exit();
        }

        $stmt = $pdo->prepare("DELETE FROM programs WHERE id = ?");
        try {
            $stmt->execute([$id]);
            echo json_encode(["status" => "success", "message" => "Program berhasil dihapus.", "id" => $id]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Gagal menghapus program: " . $e->getMessage()]);
        }
        break;

    default:
        http_response_code(45);
        echo json_encode(["status" => "error", "message" => "Method tidak diizinkan."]);
        break;
}
