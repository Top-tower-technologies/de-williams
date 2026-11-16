<?php
require_once __DIR__.'/bootstrap.php';
admin_required();
$action=$_GET['action']??'';
if($action==='staff') {
    if($_SERVER['REQUEST_METHOD']==='GET') respond(['success'=>true,'staff'=>active_staff()]);
    if($_SERVER['REQUEST_METHOD']==='POST') {
        $name=trim((string)(read_json()['name']??''));
        if($name===''||mb_strlen($name)>100) respond(['success'=>false,'message'=>'Enter a valid staff name (1–100 characters).'],422);
        $staff=read_store('staff',[]);
        foreach($staff as $s) if(mb_strtolower($s['name'])===mb_strtolower($name) && !empty($s['active'])) respond(['success'=>false,'message'=>'This staff name is already registered.'],409);
        $id=count($staff)?max(array_column($staff,'id'))+1:1;
        $staff[]=['id'=>$id,'name'=>$name,'active'=>true,'created_at'=>date(DateTimeInterface::ATOM)];
        write_store('staff',$staff);respond(['success'=>true,'staff'=>$staff]);
    }
    if($_SERVER['REQUEST_METHOD']==='DELETE') {
        $id=(int)($_GET['id']??0);$staff=read_store('staff',[]);$found=false;
        foreach($staff as &$s) if((int)$s['id']===$id){$s['active']=false;$found=true;} unset($s);
        if(!$found) respond(['success'=>false,'message'=>'Staff member not found'],404);
        write_store('staff',$staff);respond(['success'=>true]);
    }
}
if($action==='settings') {
    if($_SERVER['REQUEST_METHOD']==='GET') respond(['success'=>true,'settings'=>settings_data()]);
    if($_SERVER['REQUEST_METHOD']==='POST') {
        $b=read_json();$time=(string)($b['opening_time']??'');$grace=filter_var($b['grace_minutes']??null,FILTER_VALIDATE_INT);
        if(!preg_match('/^(?:[01]\\d|2[0-3]):[0-5]\\d$/',$time)||$grace===false||$grace<0||$grace>180) respond(['success'=>false,'message'=>'Enter a valid time and grace period (0–180 minutes).'],422);
        write_store('settings',['opening_time'=>$time,'grace_minutes'=>$grace]);respond(['success'=>true,'settings'=>settings_data()]);
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
    respond(['success'=>true,'summary'=>['staff_count'=>count($staff),'present_count'=>count($records),'late_count'=>$lateCount,'average_minutes_late'=>$lateCount?round($minutes/$lateCount,1):0],'staff_summary'=>$summary,'records'=>$formatted,'staff'=>$staff]);
}
respond(['success'=>false,'message'=>'Unknown action'],404);
