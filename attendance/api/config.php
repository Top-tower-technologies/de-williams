<?php
date_default_timezone_set('Africa/Lagos');

define('DATA_DIR', dirname(__DIR__) . '/data');
define('ALLOWED_ORIGINS', [
    'https:/www.toptowertechnologies.com',
    'http://127.0.0.1:5503'
]);
// Prefer setting ATTENDANCE_ADMIN_PASSWORD in your hosting environment.
// Replace the fallback hash before deployment.
define('ADMIN_PASSWORD_HASH', '$2y$12$trZRdnMkPsc.PrKdQl/l4eX5Ha.BRr2rrW4VAcko1mh4t.7CtujKy');

define('TOKEN_SECRET', 'f68646a09fa2fa7801c643cd6c170fca874dfeafbe4d57b186a3c7a14585bef866e394d4fcc14025c57cf4c3aefb3ade');