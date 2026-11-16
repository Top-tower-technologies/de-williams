<?php
require_once __DIR__.'/bootstrap.php';
if($_SERVER['REQUEST_METHOD']!=='POST') respond(['success'=>false,'message'=>'Method not allowed'],405);
$body=read_json();$id=(int)($body['staff_id']??0);
$staff=active_staff();$person=null;
foreach($staff as $s) if((int)$s['id']===$id){$person=$s;break;}
if(!$person) respond(['success'=>false,'message'=>'Please select a valid registered staff name'],422);

$now=new DateTimeImmutable('now',new DateTimeZone('Africa/Lagos'));
$date=$now->format('Y-m-d');$settings=settings_data();
$opening=DateTimeImmutable::createFromFormat('!Y-m-d H:i',$date.' '.$settings['opening_time'],new DateTimeZone('Africa/Lagos'));
$grace=(int)$settings['grace_minutes'];
$lateAfter=$opening->modify("+$grace minutes");
$minutesLate=max(0,(int)floor(($now->getTimestamp()-$lateAfter->getTimestamp())/60));
$status=$minutesLate>0?'late':'on_time';

$records=read_store('attendance',[]);
foreach($records as $record) {
    if((int)$record['staff_id']===$id && $record['date']===$date) {
        respond(['success'=>true,'attendance'=>$record,'already_checked_in'=>true,'message'=>'Attendance was already recorded for today.']);
    }
}
$entry=['id'=>count($records)?max(array_column($records,'id'))+1:1,'staff_id'=>$id,'staff_name'=>$person['name'],'date'=>$date,'checked_in_at'=>$now->format(DateTimeInterface::ATOM),'time'=>$now->format('h:i A'),'status'=>$status,'minutes_late'=>$minutesLate];
$records[]=$entry;
try { write_store('attendance',$records); } catch(Throwable $e) { respond(['success'=>false,'message'=>'Could not save attendance'],500); }
respond(['success'=>true,'attendance'=>$entry,'already_checked_in'=>false]);
