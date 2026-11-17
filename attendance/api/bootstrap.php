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
    $thr=isset($s['face_threshold'])?(float)$s['face_threshold']:0.5;
    if($thr<0.35||$thr>0.6) $thr=0.5;
    return ['opening_time'=>$s['opening_time']??'08:00','grace_minutes'=>(int)($s['grace_minutes']??10),'face_threshold'=>$thr];
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

/* ---------- Face verification helpers ---------- */
// A face descriptor is a list of 128 numbers produced in the browser by face-api.js.
function parse_descriptor($d) {
    if(!is_array($d)||count($d)!==128) return null;
    $out=[];
    foreach($d as $v) {
        if(!is_int($v)&&!is_float($v)) return null;
        $f=(float)$v;
        if(!is_finite($f)||abs($f)>5) return null;
        $out[]=round($f,5);
    }
    return $out;
}
function face_distance($a,$b) {
    $sum=0.0;
    for($i=0;$i<128;$i++){$x=$a[$i]-$b[$i];$sum+=$x*$x;}
    return sqrt($sum);
}
function best_face_distance($live,$person) {
    $best=null;
    foreach(($person['face']['descriptors']??[]) as $d) {
        $x=face_distance($live,$d);
        if($best===null||$x<$best) $best=$x;
    }
    return $best;
}
function has_face($s) { return !empty($s['face']['descriptors']); }
// Never send descriptors back to the browser, not even to the admin.
function staff_view($s) {
    return ['id'=>$s['id'],'name'=>$s['name'],'active'=>!empty($s['active']),'created_at'=>$s['created_at']??null,
            'face_enrolled'=>has_face($s),'face_enrolled_at'=>$s['face']['enrolled_at']??null];
}
function photos_dir() {
    $dir=DATA_DIR.'/photos';
    if(!is_dir($dir)&&!mkdir($dir,0750,true)) throw new Exception('Cannot create photo directory.');
    return $dir;
}
function save_photo($dataUrl,$filename) {
    $prefix='data:image/jpeg;base64,';
    if(!is_string($dataUrl)||strpos($dataUrl,$prefix)!==0) return false;
    $b64=substr($dataUrl,strlen($prefix));
    if($b64===''||strlen($b64)>600000) return false;
    $bin=base64_decode($b64,true);
    if($bin===false||substr($bin,0,3)!=="\xFF\xD8\xFF") return false;
    $info=@getimagesizefromstring($bin);
    if(!$info||$info[2]!==IMAGETYPE_JPEG||$info[0]>2000||$info[1]>2000) return false;
    return file_put_contents(photos_dir().'/'.$filename,$bin,LOCK_EX)!==false;
}
function delete_photo($filename) {
    $f=DATA_DIR.'/photos/'.$filename;
    if(is_file($f)) @unlink($f);
}
