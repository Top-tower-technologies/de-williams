<?php
require_once __DIR__.'/bootstrap.php';
admin_required();
$action=$_GET['action']??'';
if($action==='staff') {
    if($_SERVER['REQUEST_METHOD']==='GET') respond(['success'=>true,'staff'=>array_map('staff_view',active_staff())]);
    if($_SERVER['REQUEST_METHOD']==='POST') {
        $name=trim((string)(read_json()['name']??''));
        if($name===''||mb_strlen($name)>100) respond(['success'=>false,'message'=>'Enter a valid staff name (1–100 characters).'],422);
        $staff=read_store('staff',[]);
        foreach($staff as $s) if(mb_strtolower($s['name'])===mb_strtolower($name) && !empty($s['active'])) respond(['success'=>false,'message'=>'This staff name is already registered.'],409);
        $id=count($staff)?max(array_column($staff,'id'))+1:1;
        $staff[]=['id'=>$id,'name'=>$name,'active'=>true,'created_at'=>date(DateTimeInterface::ATOM)];
        write_store('staff',$staff);respond(['success'=>true,'staff'=>array_map('staff_view',array_values(array_filter($staff,fn($x)=>!empty($x['active']))))]);
    }
    if($_SERVER['REQUEST_METHOD']==='DELETE') {
        $id=(int)($_GET['id']??0);$staff=read_store('staff',[]);$found=false;
        foreach($staff as &$s) if((int)$s['id']===$id){$s['active']=false;unset($s['face']);delete_photo('enroll_'.$id.'.jpg');$found=true;} unset($s);
        if(!$found) respond(['success'=>false,'message'=>'Staff member not found'],404);
        write_store('staff',$staff);respond(['success'=>true]);
    }
}
if($action==='face') {
    $method=$_SERVER['REQUEST_METHOD'];
    if($method==='POST') {
        $b=read_json();$id=(int)($b['staff_id']??0);
        $descs=$b['descriptors']??null;
        if(!is_array($descs)||count($descs)<1||count($descs)>5) respond(['success'=>false,'message'=>'Capture between 1 and 5 face samples.'],422);
        $clean=[];
        foreach($descs as $d){$p=parse_descriptor($d);if(!$p) respond(['success'=>false,'message'=>'Invalid face data received. Please capture again.'],422);$clean[]=$p;}
        foreach($clean as $c) if(face_distance($clean[0],$c)>0.6) respond(['success'=>false,'message'=>'The captured samples do not look like the same person. Please capture again.'],422);
        $staff=read_store('staff',[]);$idx=null;
        foreach($staff as $i=>$s) if((int)$s['id']===$id&&!empty($s['active'])){$idx=$i;break;}
        if($idx===null) respond(['success'=>false,'message'=>'Staff member not found'],404);
        foreach($staff as $s) {
            if((int)$s['id']===$id||empty($s['active'])||!has_face($s)) continue;
            $d=best_face_distance($clean[0],$s);
            if($d!==null&&$d<0.4) respond(['success'=>false,'message'=>'This face is already registered to '.$s['name'].'.'],409);
        }
        if(!save_photo($b['photo']??null,'enroll_'.$id.'.jpg')) respond(['success'=>false,'message'=>'Could not read the captured photo. Please try again.'],422);
        $staff[$idx]['face']=['descriptors'=>$clean,'enrolled_at'=>date(DateTimeInterface::ATOM)];
        try { write_store('staff',$staff); } catch(Throwable $e) { respond(['success'=>false,'message'=>'Could not save face data'],500); }
        respond(['success'=>true,'staff'=>staff_view($staff[$idx])]);
    }
    if($method==='DELETE') {
        $id=(int)($_GET['id']??0);$staff=read_store('staff',[]);$found=false;
        foreach($staff as &$s) if((int)$s['id']===$id){unset($s['face']);$found=true;} unset($s);
        if(!$found) respond(['success'=>false,'message'=>'Staff member not found'],404);
        delete_photo('enroll_'.$id.'.jpg');write_store('staff',$staff);respond(['success'=>true]);
    }
}
if($action==='photo'&&$_SERVER['REQUEST_METHOD']==='GET') {
    $file=(string)($_GET['file']??'');
    if(!preg_match('/^(?:enroll|checkin)_\d+\.jpg$/',$file)||!is_file(DATA_DIR.'/photos/'.$file)) respond(['success'=>false,'message'=>'Photo not found'],404);
    header('Content-Type: image/jpeg');header('X-Content-Type-Options: nosniff');header('Cache-Control: private, max-age=300');
    readfile(DATA_DIR.'/photos/'.$file);exit;
}
if($action==='settings') {
    if($_SERVER['REQUEST_METHOD']==='GET') respond(['success'=>true,'settings'=>settings_data()]);
    if($_SERVER['REQUEST_METHOD']==='POST') {
        $b=read_json();$time=(string)($b['opening_time']??'');$grace=filter_var($b['grace_minutes']??null,FILTER_VALIDATE_INT);
        if(!preg_match('/^(?:[01]\\d|2[0-3]):[0-5]\\d$/',$time)||$grace===false||$grace<0||$grace>180) respond(['success'=>false,'message'=>'Enter a valid time and grace period (0–180 minutes).'],422);
        $thr=isset($b['face_threshold'])?filter_var($b['face_threshold'],FILTER_VALIDATE_FLOAT):settings_data()['face_threshold'];
        if($thr===false||$thr<0.35||$thr>0.6) respond(['success'=>false,'message'=>'Face match strictness must be between 0.35 and 0.60.'],422);
        write_store('settings',['opening_time'=>$time,'grace_minutes'=>$grace,'face_threshold'=>$thr]);respond(['success'=>true,'settings'=>settings_data()]);
    }
}
if($action==='dashboard'||$action==='attendance') {
    $from=$_GET['from']??date('Y-m-01');$to=$_GET['to']??date('Y-m-d');
    if(!preg_match('/^\\d{4}-\\d{2}-\\d{2}$/',$from)||!preg_match('/^\\d{4}-\\d{2}-\\d{2}$/',$to)||$from>$to) respond(['success'=>false,'message'=>'Invalid date range'],422);
    $all=read_store('attendance',[]);
    $records=array_values(array_filter($all,fn($r)=>$r['date']>=$from&&$r['date']<=$to));
    usort($records,fn($a,$b)=>[$b['date'],$b['checked_in_at']]<=>[$a['date'],$a['checked_in_at']]);
    $formatted=array_map(function($r){$r['time']=date('h:i A',strtotime($r['checked_in_at']));return $r;},$records);
    if($action==='attendance') respond(['success'=>true,'records'=>$formatted]);
    $staff=active_staff();$summary=[];
    foreach($staff as $s) {
        $mine=array_values(array_filter($records,fn($r)=>(int)$r['staff_id']===(int)$s['id']));
        $late=array_values(array_filter($mine,fn($r)=>$r['status']==='late'));
        $sum=array_sum(array_column($late,'minutes_late'));
        $count=count($mine);
        $summary[]=['id'=>$s['id'],'name'=>$s['name'],'present_count'=>$count,'late_count'=>count($late),'late_rate'=>$count?round(count($late)/$count*100,1):0,'total_minutes_late'=>$sum];
    }
    usort($summary,fn($a,$b)=>$b['late_count']<=>$a['late_count']);
    $lateRows=array_values(array_filter($records,fn($r)=>$r['status']==='late'));
    $lateCount=count($lateRows);$minutes=array_sum(array_column($lateRows,'minutes_late'));
    respond(['success'=>true,'summary'=>['staff_count'=>count($staff),'present_count'=>count($records),'late_count'=>$lateCount,'average_minutes_late'=>$lateCount?round($minutes/$lateCount,1):0],'staff_summary'=>$summary,'records'=>$formatted,'staff'=>array_map('staff_view',$staff)]);
}
respond(['success'=>false,'message'=>'Unknown action'],404);
