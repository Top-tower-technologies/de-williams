<?php
require_once __DIR__ . '/config.php';

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, ALLOWED_ORIGINS, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

function respond($payload, $status=200) {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}
function read_json() {
    $raw=file_get_contents('php://input');
    $data=json_decode($raw,true);
    return is_array($data)?$data:[];
}
function store_file($name) { return DATA_DIR . '/' . $name . '.json'; }
function read_store($name,$default) {
    $file=store_file($name);
    if (!file_exists($file)) return $default;
    $data=json_decode(file_get_contents($file),true);
    return is_array($data)?$data:$default;
}
function write_store($name,$data) {
    if (!is_dir(DATA_DIR) && !mkdir(DATA_DIR,0750,true)) throw new Exception('Cannot create data directory.');
    $file=store_file($name);$fp=fopen($file,'c+');
    if(!$fp) throw new Exception('Cannot open data store.');
    try { if(!flock($fp,LOCK_EX)) throw new Exception('Cannot lock data store.'); ftruncate($fp,0); rewind($fp); fwrite($fp,json_encode($data,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES)); fflush($fp); flock($fp,LOCK_UN); }
    finally { fclose($fp); }
}
function settings_data() {
    $s=read_store('settings',['opening_time'=>'08:00','grace_minutes'=>10]);
    return ['opening_time'=>$s['opening_time']??'08:00','grace_minutes'=>(int)($s['grace_minutes']??10)];
}
function admin_required() {
    $header=$_SERVER['HTTP_AUTHORIZATION']??'';
    if(!preg_match('/Bearer\\s+(.+)/i',$header,$m)) respond(['success'=>false,'message'=>'Unauthorized'],401);
    $parts=explode('.',$m[1]);
    if(count($parts)!==2) respond(['success'=>false,'message'=>'Unauthorized'],401);
    $expected=hash_hmac('sha256',$parts[0],TOKEN_SECRET);
    if(!hash_equals($expected,$parts[1]) || (int)$parts[0] < time()) respond(['success'=>false,'message'=>'Unauthorized'],401);
}
function make_token() {
    $payload=(string)(time()+43200);
    return $payload.'.'.hash_hmac('sha256',$payload,TOKEN_SECRET);
}
function active_staff() {
    return array_values(array_filter(read_store('staff',[]),fn($s)=>!empty($s['active'])));
}
