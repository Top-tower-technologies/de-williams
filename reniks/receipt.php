<?php
// public/receipt.php
// Usage: receipt.php?id=<SALE_ID>

$id = $_GET["id"] ?? "";

// simple HTTP GET to API
function http_get($pathWithQuery) {
    if (strpos($pathWithQuery, "http") !== 0) {
        $scheme = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? "https" : "http";
        $base = $scheme . "://" . $_SERVER['HTTP_HOST'] . dirname($_SERVER['REQUEST_URI']);
        $pathWithQuery = rtrim($base, "/") . "/" . ltrim($pathWithQuery, "/");
    }
    if (function_exists('curl_init')) {
        $ch = curl_init($pathWithQuery);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $res = curl_exec($ch);
        curl_close($ch);
        return $res;
    }
    return @file_get_contents($pathWithQuery);
}

$saleRes = json_decode(http_get("../api/api.php?action=get_sale&id=" . urlencode($id)), true);
$settingsRes = json_decode(http_get("../api/api.php?action=get_settings"), true);

$okSale = is_array($saleRes) && !empty($saleRes["ok"]);
$okSettings = is_array($settingsRes) && !empty($settingsRes["ok"]);
$store = $okSettings ? $settingsRes["settings"] : ["store_name"=>"Your Store","address_line"=>"","phone"=>"","receipt_footer"=>""];

function nf($n){ return number_format((float)$n, 2); }
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Receipt <?= htmlspecialchars($id ?: ""); ?></title>
<style>
  body{font-family:Arial, sans-serif; max-width:380px; margin:0 auto; padding:10px; color:#111;}
  h1,h2,h3{margin:4px 0;}
  .header,.footer{text-align:center;}
  .table{width:100%; border-collapse:collapse;}
  .table th,.table td{border-bottom:1px dashed #999; padding:6px; font-size:14px; text-align:left;}
  .table th:nth-child(2), .table td:nth-child(2){ text-align:center;}
  .table th:nth-child(3), .table td:nth-child(3),
  .table th:nth-child(4), .table td:nth-child(4){ text-align:right;}
  .summary{width:100%; margin-top:8px;}
  .summary td{font-size:14px; padding:4px 0;}
  .summary td:last-child{text-align:right;}
  .small{font-size:12px; color:#555;}
  .print-btn{display:block; width:100%; margin:10px 0; padding:8px; border:1px solid #333; background:#fff; cursor:pointer;}
  @media print {.print-btn{display:none;}}
</style>
</head>
<body>
  <div class="header">
    <h2><?= htmlspecialchars($store["store_name"]); ?></h2>
    <?php if (!empty($store["address_line"]) || !empty($store["phone"])): ?>
      <div class="small">
        <?= htmlspecialchars($store["address_line"]); ?><br/>
        <?= htmlspecialchars($store["phone"]); ?>
      </div>
    <?php endif; ?>
    <hr/>
  </div>

  <?php if (!$okSale): ?>
    <p>Sale not found.</p>
  <?php else: ?>
    <?php $s = $saleRes["sale"]; ?>
    <div class="small">
      Receipt ID: <?= htmlspecialchars($s["id"]); ?> |
      <?= htmlspecialchars($s["timestamp"]); ?> |
      Method: <?= htmlspecialchars($s["method"]); ?><br/>
      Cashier: <strong><?= htmlspecialchars($s["cashier"] ?? ""); ?></strong>
    </div>

    <table class="table">
      <thead>
        <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
      </thead>
      <tbody>
        <?php foreach ($s["items"] as $it): ?>
          <tr>
            <td><?= htmlspecialchars($it["name"]); ?></td>
            <td><?= (int)$it["qty"]; ?></td>
            <td><?= nf($it["price"]); ?></td>
            <td><?= nf($it["total"]); ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>

    <table class="summary">
      <tr><td>Subtotal (before discount)</td><td><?= nf($s["subtotal_before_discount"]); ?></td></tr>
      <tr><td>Discount</td><td>-<?= nf($s["discount_amount"]); ?></td></tr>
      <tr><td>Subtotal</td><td><?= nf($s["subtotal"]); ?></td></tr>
      <tr><td>Tax</td><td><?= nf($s["tax"]); ?></td></tr>
      <tr><td><strong>Total</strong></td><td><strong><?= nf($s["total"]); ?></strong></td></tr>
      <tr><td>Paid (<?= htmlspecialchars($s["method"]); ?>)</td><td><?= nf($s["paid"]); ?></td></tr>
      <tr><td>Change Due</td><td><?= nf($s["change_due"]); ?></td></tr>
    </table>

    <div class="footer">
      <hr/>
      <?php if (!empty($store["receipt_footer"])): ?>
        <div class="small"><?= htmlspecialchars($store["receipt_footer"]); ?></div>
      <?php endif; ?>
      <button class="print-btn" onclick="window.print()">Print</button>
    </div>
  <?php endif; ?>
</body>
</html>
