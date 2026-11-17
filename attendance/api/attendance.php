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

/* ---- Face verification: the live face must match the face the admin registered ---- */
if(!has_face($person)) respond(['success'=>false,'message'=>'Your face has not been registered yet. Please ask the administrator to register it.','code'=>'no_face'],409);
$live=parse_descriptor($body['descriptor']??null);
if(!$live) respond(['success'=>false,'message'=>'No face data received. Please capture your face again.','code'=>'bad_face'],422);
$distance=best_face_distance($live,$person);
if($distance===null||$distance>$settings['face_threshold']) {
    respond(['success'=>false,'message'=>'Face not recognised. Make sure you selected your own name, face the camera in good light and try again.','code'=>'face_mismatch'],403);
}

$entryId=count($records)?max(array_column($records,'id'))+1:1;
$photoName='checkin_'.$entryId.'.jpg';
if(!save_photo($body['photo']??null,$photoName)) respond(['success'=>false,'message'=>'Could not read the captured photo. Please try again.','code'=>'bad_photo'],422);

$entry=['id'=>$entryId,'staff_id'=>$id,'staff_name'=>$person['name'],'date'=>$date,'checked_in_at'=>$now->format(DateTimeInterface::ATOM),'time'=>$now->format('h:i A'),'status'=>$status,'minutes_late'=>$minutesLate,'face_verified'=>true,'face_distance'=>round($distance,3),'photo'=>$photoName];
$records[]=$entry;
try { write_store('attendance',$records); } catch(Throwable $e) { delete_photo($photoName); respond(['success'=>false,'message'=>'Could not save attendance'],500); }
respond(['success'=>true,'attendance'=>$entry,'already_checked_in'=>false]);
