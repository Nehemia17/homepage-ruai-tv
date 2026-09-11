<?php
require_once __DIR__ . '/../api/db.php';
$stmt = $pdo->prepare("UPDATE programs SET duration = ? WHERE id = ?");
$stmt->execute(['Cek Jadwal Mingguan', 'cbn-solusi']);
echo "Rows updated: " . $stmt->rowCount() . "\n";
