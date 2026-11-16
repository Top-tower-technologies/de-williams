<?php
require_once __DIR__.'/bootstrap.php';
if($_SERVER['REQUEST_METHOD']!=='POST') respond(['success'=>false,'message'=>'Method not allowed'],405);
$body=read_json();$password=(string)($body['password']??'');
$env=getenv('ATTENDANCE_ADMIN_PASSWORD');
$valid=$env ? hash_equals($env,$password) : password_verify($password,ADMIN_PASSWORD_HASH);
if(!$valid) respond(['success'=>false,'message'=>'Incorrect admin password'],401);
respond(['success'=>true,'token'=>make_token()]);
