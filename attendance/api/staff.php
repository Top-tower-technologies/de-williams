<?php
require_once __DIR__.'/bootstrap.php';
if($_SERVER['REQUEST_METHOD']!=='GET') respond(['success'=>false,'message'=>'Method not allowed'],405);
$staff=active_staff();
respond(['success'=>true,'staff'=>array_map(fn($s)=>['id'=>$s['id'],'name'=>$s['name']],$staff)]);
