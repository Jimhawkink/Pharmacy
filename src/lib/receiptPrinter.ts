// Thermal Receipt Printing Utilities
// Works with 58mm and 80mm thermal printers

export interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
  total: number;
  notes?: string;
  discount?: number;
}

export interface ReceiptData {
  invoiceNo: string;
  date: string;
  time: string;
  cashier: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  change: number;
  customerName?: string;
  customerPhone?: string;
  mpesaReceipt?: string;
  tableNo?: string;
  orderNotes?: string;
  shiftCode?: string;
  isPaid?: boolean;
}

export interface KOTData {
  kotNo: string;
  date: string;
  time: string;
  orderType: string;
  tableNo?: string;
  waiter?: string;
  items: {
    name: string;
    qty: number;
    notes?: string;
  }[];
  orderNotes?: string;
  priority?: 'normal' | 'rush';
}

export interface CompanyInfo {
  name: string;
  address: string;
  phone: string;
  email?: string;
  pin?: string;
  logo?: string;
  slogan?: string;
}

// Default company info - will be loaded from database
let cachedCompanyInfo: CompanyInfo | null = null;

const defaultCompanyInfo: CompanyInfo = {
  name: 'ALPHA PLUS RESTAURANT',
  address: 'Main Street, Nairobi',
  phone: '+254 712 345 678',
  email: 'info@alphaplus.co.ke',
  pin: 'P051234567X',
  slogan: 'Quality Food, Great Service!'
};

// Load company info from database (organisation_settings table)
export async function loadCompanyInfo(): Promise<CompanyInfo> {
  if (cachedCompanyInfo) return cachedCompanyInfo;

  try {
    // First try localStorage cache
    const storedSettings = localStorage.getItem('company_settings');
    if (storedSettings) {
      const settings = JSON.parse(storedSettings);
      cachedCompanyInfo = {
        name: settings.company_name || settings.name || defaultCompanyInfo.name,
        address: settings.address || defaultCompanyInfo.address,
        phone: settings.phone || defaultCompanyInfo.phone,
        email: settings.email || defaultCompanyInfo.email,
        pin: settings.kra_pin || settings.pin || defaultCompanyInfo.pin,
        slogan: settings.slogan || settings.tagline || defaultCompanyInfo.slogan,
        logo: settings.logo
      };
      return cachedCompanyInfo;
    }

    // If not in localStorage, try to fetch from Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: settingsData } = await supabase
        .from('organisation_settings')
        .select('setting_key, setting_value');

      if (settingsData && settingsData.length > 0) {
        const settingsMap: { [key: string]: string } = {};
        settingsData.forEach((item: { setting_key: string; setting_value: string }) => {
          settingsMap[item.setting_key] = item.setting_value;
        });

        cachedCompanyInfo = {
          name: settingsMap['company_name'] || defaultCompanyInfo.name,
          address: settingsMap['address'] ?
            (settingsMap['city'] ? `${settingsMap['address']}, ${settingsMap['city']}` : settingsMap['address'])
            : defaultCompanyInfo.address,
          phone: settingsMap['phone'] || defaultCompanyInfo.phone,
          email: settingsMap['email'] || defaultCompanyInfo.email,
          pin: settingsMap['kra_pin'] || defaultCompanyInfo.pin,
          slogan: settingsMap['footer_note'] || settingsMap['slogan'] || defaultCompanyInfo.slogan,
        };

        // Cache to localStorage for faster subsequent loads
        localStorage.setItem('company_settings', JSON.stringify({
          company_name: cachedCompanyInfo.name,
          address: settingsMap['address'] || '',
          city: settingsMap['city'] || '',
          phone: cachedCompanyInfo.phone,
          email: cachedCompanyInfo.email,
          kra_pin: cachedCompanyInfo.pin,
          slogan: cachedCompanyInfo.slogan
        }));

        return cachedCompanyInfo;
      }
    }

    return defaultCompanyInfo;
  } catch (error) {
    console.error('Error loading company info:', error);
    return defaultCompanyInfo;
  }
}

// Get cached or default company info (synchronous)
export function getCompanyInfo(): CompanyInfo {
  return cachedCompanyInfo || defaultCompanyInfo;
}

// Generate SUPER POWERFUL Customer Bill HTML with NOT PAID watermark
export function generateCustomerBillHTML(data: ReceiptData, company: CompanyInfo = defaultCompanyInfo, isPaid: boolean = false): string {
  const itemRows = data.items.map((item, index) => `
    <tr>
      <td>${index + 1}. ${item.name}</td>
      <td>${item.qty}</td>
      <td>${item.price.toLocaleString()}</td>
      <td style="font-weight:bold;">${item.total.toLocaleString()}</td>
    </tr>
    ${item.notes ? `<tr><td colspan="4" style="font-size:9px;color:#c00;padding:1px 0 2px 12px;font-style:italic;">↳ ${item.notes}</td></tr>` : ''}
  `).join('');

  const watermarkStyle = !isPaid ? `
    <div style="
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 60px;
      font-weight: bold;
      color: rgba(255, 0, 0, 0.15);
      text-transform: uppercase;
      letter-spacing: 10px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 1000;
    ">NOT PAID</div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Customer Bill - ${data.invoiceNo}</title>
  <style>
    @page {
      margin: 0;
      size: 80mm auto;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', 'Arial', sans-serif;
      font-size: 11px;
      width: 80mm;
      padding: 2mm 3mm;
      background: #fff;
      color: #000;
      position: relative;
      overflow: hidden;
    }
    .header {
      text-align: center;
      padding-bottom: 6px;
      border-bottom: 2px double #000;
      margin-bottom: 6px;
    }
    .company-logo {
      font-size: 18px;
      margin-bottom: 2px;
    }
    .company-name {
      font-size: 14px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 2px;
    }
    .company-details {
      font-size: 10px;
      color: #333;
      line-height: 1.4;
    }
    .slogan {
      font-size: 9px;
      font-style: italic;
      color: #666;
      margin-top: 5px;
    }
    .bill-title {
      background: #000;
      color: #fff;
      text-align: center;
      padding: 4px;
      font-size: 12px;
      font-weight: bold;
      letter-spacing: 2px;
      margin: 4px 0;
    }
    .info-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2px 8px;
      padding: 4px 6px;
      background: #f5f5f5;
      border-radius: 3px;
      margin: 4px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
    }
    .info-label {
      color: #666;
      font-size: 10px;
    }
    .info-value {
      font-weight: bold;
      font-size: 11px;
    }
    .table-badge {
      background: #000;
      color: #fff;
      padding: 5px 15px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: bold;
      display: inline-block;
      margin: 5px 0;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
      table-layout: fixed;
    }
    .items-table th {
      background: #eee;
      padding: 3px 1px;
      text-align: left;
      font-size: 9px;
      font-weight: bold;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
    }
    .items-table td {
      font-size: 10px;
      padding: 2px 1px;
      border-bottom: 1px dotted #ccc;
      vertical-align: top;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .items-table td:first-child {
      text-align: left;
    }
    .items-table td:nth-child(2) {
      text-align: center;
      white-space: nowrap;
    }
    .items-table td:nth-child(3) {
      text-align: right;
      white-space: nowrap;
      padding-right: 4px;
    }
    .items-table td:nth-child(4) {
      text-align: right;
      white-space: nowrap;
      padding-right: 6px;
    }
    .items-table th:nth-child(2) {
      text-align: center;
    }
    .items-table th:nth-child(3) {
      text-align: right;
      padding-right: 4px;
    }
    .items-table th:nth-child(4) {
      text-align: right;
      padding-right: 6px;
    }
    .totals-section {
      border-top: 1px solid #000;
      padding-top: 3px;
      margin-top: 2px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 1px 4px 1px 0;
      font-size: 11px;
    }
    .grand-total {
      background: #000;
      color: #fff;
      padding: 5px 8px 5px 6px;
      margin: 2px 0;
      border-radius: 3px;
    }
    .grand-total .total-row {
      font-size: 14px;
      font-weight: bold;
    }
    .payment-section {
      background: #f0fff0;
      border: 1px solid #4CAF50;
      padding: 6px;
      border-radius: 3px;
      margin: 4px 0;
    }
    .payment-section.unpaid {
      background: #fff0f0;
      border-color: #f44336;
    }
    .payment-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .payment-badge.paid {
      background: #4CAF50;
      color: #fff;
    }
    .payment-badge.unpaid {
      background: #f44336;
      color: #fff;
    }
    .order-notes {
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 8px;
      border-radius: 5px;
      margin: 10px 0;
      font-size: 10px;
    }
    .footer {
      text-align: center;
      margin-top: 6px;
      padding-top: 4px;
      border-top: 1px dashed #000;
    }
    .thank-you {
      font-size: 11px;
      font-weight: bold;
      margin-bottom: 2px;
    }
    .footer-note {
      font-size: 8px;
      color: #666;
      margin-top: 2px;
    }
    .qr-section {
      text-align: center;
      margin: 4px 0 2px 0;
      padding: 3px 0;
    }
    .powered-by {
      font-size: 7px;
      color: #999;
      margin-top: 3px;
    }
    @media print {
      body { width: 80mm; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  ${watermarkStyle}

  <!-- Header -->
  <div class="header">
    <div class="company-logo">🛒</div>
    <div class="company-name">${company.name}</div>
    <div class="company-details">
      📍 ${company.address}<br>
      📞 ${company.phone}
      ${company.email ? `<br>✉️ ${company.email}` : ''}
      ${company.pin ? `<br>PIN: ${company.pin}` : ''}
    </div>
    ${company.slogan ? `<div class="slogan">"${company.slogan}"</div>` : ''}
  </div>

  <!-- Bill Title -->
  <div class="bill-title">
    ${isPaid ? '✓ TAX INVOICE ✓' : '⚠ CUSTOMER BILL ⚠'}
  </div>

  <!-- Invoice Info with QR Code -->
  <div style="display:flex;align-items:center;gap:6px;padding:4px;background:#f5f5f5;border-radius:3px;margin:4px 0;">
    <div style="flex:1;">
      <div style="margin-bottom:3px;"><span style="font-size:9px;color:#666;">Invoice No:</span><br/><span style="font-size:11px;font-weight:bold;">${data.invoiceNo}</span></div>
      <div><span style="font-size:9px;color:#666;">Time:</span><br/><span style="font-size:10px;font-weight:bold;">${data.time}</span></div>
    </div>
    <div style="text-align:center;">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(data.invoiceNo + '|' + company.name + '|Ksh' + data.total + '|' + data.date)}" 
        style="width:55px;height:55px;display:block;" alt="QR" />
    </div>
    <div style="flex:1;text-align:right;">
      <div style="margin-bottom:3px;"><span style="font-size:9px;color:#666;">Date:</span><br/><span style="font-size:10px;font-weight:bold;">${data.date}</span></div>
      <div><span style="font-size:9px;color:#666;">Cashier:</span><br/><span style="font-size:10px;font-weight:bold;">${data.cashier}</span></div>
    </div>
  </div>

  ${data.tableNo ? `
  <div style="text-align:center;">
    <span class="table-badge">🪑 TABLE ${data.tableNo}</span>
  </div>
  ` : ''}

  ${data.customerName ? `
  <div style="text-align:center;margin:5px 0;">
    <span style="font-size:12px;">👤 Customer: <strong>${data.customerName}</strong></span>
  </div>
  ` : ''}

  <!-- Items -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width:38%">ITEM</th>
        <th style="width:10%">QTY</th>
        <th style="width:24%">PRICE</th>
        <th style="width:28%">TOTAL</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals-section">
    <div class="total-row">
      <span>Subtotal (${data.items.length} items):</span>
      <span style="font-weight:bold;">Ksh ${data.subtotal.toLocaleString()}</span>
    </div>
    ${data.discount > 0 ? `
    <div class="total-row" style="color:#4CAF50;">
      <span>💰 Discount:</span>
      <span style="font-weight:bold;">- Ksh ${data.discount.toLocaleString()}</span>
    </div>
    ` : ''}
    ${data.tax > 0 ? `
    <div class="total-row">
      <span>VAT (16%):</span>
      <span>Ksh ${data.tax.toLocaleString()}</span>
    </div>
    ` : ''}
  </div>

  <!-- Grand Total -->
  <div class="grand-total">
    <div class="total-row">
      <span>GRAND TOTAL:</span>
      <span>Ksh ${data.total.toLocaleString()}</span>
    </div>
  </div>

  <!-- Payment Status -->
  <div class="payment-section ${isPaid ? '' : 'unpaid'}">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span class="payment-badge ${isPaid ? 'paid' : 'unpaid'}">
        ${isPaid ? '✓ PAID' : '✗ NOT PAID'}
      </span>
      <span style="font-weight:bold;font-size:12px;">
        ${isPaid ? data.paymentMethod.toUpperCase() : 'PENDING'}
      </span>
    </div>
    ${isPaid ? `
    <div style="margin-top:8px;font-size:11px;">
      <div class="total-row">
        <span>Amount Paid:</span>
        <span>Ksh ${data.amountPaid.toLocaleString()}</span>
      </div>
      ${data.change > 0 ? `
      <div class="total-row" style="color:#4CAF50;font-weight:bold;">
        <span>🔄 Change:</span>
        <span>Ksh ${data.change.toLocaleString()}</span>
      </div>
      ` : ''}
      ${data.mpesaReceipt ? `
      <div class="total-row" style="font-size:10px;">
        <span>M-Pesa Ref:</span>
        <span>${data.mpesaReceipt}</span>
      </div>
      ` : ''}
    </div>
    ` : `
    <div style="margin-top:8px;text-align:center;font-size:11px;color:#c00;">
      ⚠️ Please pay at the counter
    </div>
    `}
  </div>

  ${data.orderNotes ? `
  <div class="order-notes">
    📝 <strong>Note:</strong> ${data.orderNotes}
  </div>
  ` : ''}

  <!-- Receipt No -->
  <div style="text-align:center;margin:4px 0 2px 0;padding:2px 0;border-top:1px dashed #ccc;">
    <div style="font-size:9px;font-weight:bold;letter-spacing:1px;">${data.invoiceNo}</div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="thank-you">★ THANK YOU FOR SHOPPING WITH US! ★</div>
    <div style="font-size:10px;">We appreciate your business</div>
    <div class="footer-note">
      ${isPaid ? 'This serves as your official tax invoice' : 'This is not a tax invoice until payment is complete'}
    </div>
    <div class="footer-note">
      Goods once sold are not refundable
    </div>
    <div class="powered-by">
      Powered by Alpha Plus POS v2.0
    </div>
  </div>
</body>
</html>
`;
}

// Generate thermal receipt HTML (for paid receipts)
export function generateReceiptHTML(data: ReceiptData, company: CompanyInfo = defaultCompanyInfo): string {
  return generateCustomerBillHTML(data, company, true);
}

// Generate KOT (Kitchen Order Ticket) HTML
export function generateKOTHTML(data: KOTData, company: CompanyInfo = defaultCompanyInfo): string {
  const itemRows = data.items.map((item, index) => `
    <tr>
      <td style="font-size:10px;color:#666;padding:8px 5px;border-bottom:1px solid #ddd;">${index + 1}.</td>
      <td style="font-size:16px;font-weight:bold;padding:8px 5px;border-bottom:1px solid #ddd;">${item.name}</td>
      <td style="font-size:20px;font-weight:bold;text-align:center;background:#000;color:#fff;width:50px;padding:8px;">${item.qty}</td>
    </tr>
    ${item.notes ? `
    <tr>
      <td></td>
      <td colspan="2" style="font-size:13px;color:#c00;padding:5px 15px;background:#fff0f0;border-radius:5px;font-weight:bold;">
        ⚠️ ${item.notes.toUpperCase()}
      </td>
    </tr>
    ` : ''}
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>KOT - ${data.kotNo}</title>
  <style>
    @page {
      margin: 0;
      size: 80mm auto;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Arial', sans-serif;
      font-size: 12px;
      width: 80mm;
      padding: 5mm;
      background: #fff;
      color: #000;
    }
    .header {
      background: #000;
      color: #fff;
      text-align: center;
      padding: 12px;
      margin: -5mm -5mm 10px -5mm;
    }
    .kot-title {
      font-size: 28px;
      font-weight: bold;
      letter-spacing: 3px;
    }
    .kot-no {
      font-size: 24px;
      font-weight: bold;
      margin-top: 5px;
    }
    .rush {
      background: #c00 !important;
      animation: blink 0.5s infinite;
    }
    @keyframes blink {
      50% { opacity: 0.7; }
    }
    .info-box {
      border: 2px solid #000;
      padding: 10px;
      margin: 10px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin: 4px 0;
      font-size: 13px;
    }
    .table-no {
      font-size: 36px;
      font-weight: bold;
      text-align: center;
      padding: 15px;
      border: 4px solid #000;
      margin: 10px 0;
      background: #f0f0f0;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    .items-table td {
      vertical-align: middle;
    }
    .order-notes {
      background: #fff3cd;
      border: 3px solid #ffc107;
      padding: 12px;
      margin: 10px 0;
      font-size: 14px;
      font-weight: bold;
      text-align: center;
    }
    .footer {
      text-align: center;
      margin-top: 15px;
      font-size: 10px;
      color: #666;
    }
    .time-stamp {
      font-size: 16px;
      font-weight: bold;
      text-align: center;
      border-top: 3px solid #000;
      padding-top: 12px;
      margin-top: 10px;
    }
    @media print {
      body { width: 80mm; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header ${data.priority === 'rush' ? 'rush' : ''}">
    <div class="kot-title">🍳 K.O.T 🍳</div>
    <div class="kot-no">#${data.kotNo}</div>
    ${data.priority === 'rush' ? '<div style="font-size:20px;margin-top:5px;">⚡ RUSH ORDER ⚡</div>' : ''}
  </div>

  <!-- Table Number -->
  ${data.tableNo ? `
  <div class="table-no">
    🪑 TABLE ${data.tableNo}
  </div>
  ` : `
  <div class="table-no" style="background:#ffe0b2;border-color:#ff9800;">
    🛍️ ${data.orderType.toUpperCase()}
  </div>
  `}

  <!-- Order Info -->
  <div class="info-box">
    <div class="info-row">
      <span>Order Type:</span>
      <span style="font-weight:bold;font-size:14px;">${data.orderType.toUpperCase()}</span>
    </div>
    <div class="info-row">
      <span>Date:</span>
      <span>${data.date}</span>
    </div>
    <div class="info-row">
      <span>Time:</span>
      <span style="font-size:18px;font-weight:bold;">${data.time}</span>
    </div>
    ${data.waiter ? `
    <div class="info-row">
      <span>Waiter:</span>
      <span style="font-weight:bold;">${data.waiter}</span>
    </div>
    ` : ''}
  </div>

  <!-- Items -->
  <table class="items-table">
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <!-- Order Notes -->
  ${data.orderNotes ? `
  <div class="order-notes">
    📝 ${data.orderNotes.toUpperCase()}
  </div>
  ` : ''}

  <!-- Time Stamp -->
  <div class="time-stamp">
    ⏰ ${data.date} ${data.time}
  </div>

  <!-- Footer -->
  <div class="footer">
    ${company.name}
  </div>
</body>
</html>
`;
}

// Print function - uses iframe to avoid popup blockers
export function printReceipt(html: string): void {
  console.log('🖨️ Printing receipt...');

  // Create hidden iframe for printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();

    // Wait for content to load then print
    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          console.log('🖨️ Print dialog opened');
        } catch (e) {
          console.error('Print error:', e);
        }
        // Remove iframe after printing
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 300);
    };
  } else {
    console.error('Could not create print iframe');
    document.body.removeChild(iframe);
  }
}

// Direct print to thermal printer (for connected printers)
export async function printToThermalPrinter(html: string, printerName?: string): Promise<boolean> {
  try {
    // Create a hidden iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 100));

      // Print
      iframe.contentWindow?.print();

      // Remove iframe after print
      setTimeout(() => document.body.removeChild(iframe), 1000);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Print error:', error);
    return false;
  }
}

// Generate receipt data from cart
export function createReceiptData(
  invoiceNo: string,
  items: { name: string; qty: number; price: number; notes?: string; discount?: number }[],
  paymentMethod: string,
  amountPaid: number,
  cashier: string,
  options?: {
    customerName?: string;
    mpesaReceipt?: string;
    tableNo?: string;
    orderNotes?: string;
    shiftCode?: string;
    discount?: number;
    tax?: number;
    isPaid?: boolean;
  }
): ReceiptData {
  const now = new Date();
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const itemDiscounts = items.reduce((sum, item) => sum + (item.discount || 0), 0);
  const totalDiscount = itemDiscounts + (options?.discount || 0);
  const total = subtotal - totalDiscount + (options?.tax || 0);
  const change = paymentMethod === 'cash' ? Math.max(0, amountPaid - total) : 0;

  return {
    invoiceNo,
    date: now.toLocaleDateString('en-GB'),
    time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    cashier,
    items: items.map(item => ({
      name: item.name,
      qty: item.qty,
      price: item.price,
      total: item.price * item.qty,
      notes: item.notes,
      discount: item.discount
    })),
    subtotal,
    discount: totalDiscount,
    tax: options?.tax || 0,
    total,
    paymentMethod,
    amountPaid,
    change,
    customerName: options?.customerName,
    mpesaReceipt: options?.mpesaReceipt,
    tableNo: options?.tableNo,
    orderNotes: options?.orderNotes,
    shiftCode: options?.shiftCode,
    isPaid: options?.isPaid ?? true
  };
}

// Generate KOT data from cart
export function createKOTData(
  kotNo: string,
  items: { name: string; qty: number; notes?: string }[],
  orderType: string = 'Dine-In',
  options?: {
    tableNo?: string;
    waiter?: string;
    orderNotes?: string;
    priority?: 'normal' | 'rush';
  }
): KOTData {
  const now = new Date();

  return {
    kotNo,
    date: now.toLocaleDateString('en-GB'),
    time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    orderType,
    tableNo: options?.tableNo,
    waiter: options?.waiter,
    items: items.map(item => ({
      name: item.name,
      qty: item.qty,
      notes: item.notes
    })),
    orderNotes: options?.orderNotes,
    priority: options?.priority || 'normal'
  };
}

// Print customer receipt
export function printCustomerReceipt(data: ReceiptData, company?: CompanyInfo): void {
  const html = generateReceiptHTML(data, company);
  printReceipt(html);
}

// Print KOT
export function printKOT(data: KOTData, company?: CompanyInfo): void {
  const html = generateKOTHTML(data, company);
  printReceipt(html);
}

// Print unpaid customer bill (with NOT PAID watermark)
export function printUnpaidBill(data: ReceiptData, company?: CompanyInfo): void {
  const html = generateCustomerBillHTML(data, company, false);
  printReceipt(html);
}

// Mask phone number for privacy (e.g., 0712345678 -> 07123****8)
export function maskPhoneNumber(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('254') && cleaned.length >= 12) {
    // Format: 254712****78
    return `${cleaned.slice(0, 6)}****${cleaned.slice(-2)}`;
  }
  if (cleaned.length >= 10) {
    // Format: 0712****78 (show first 4, mask last 4, show final 2)
    return `${cleaned.slice(0, 4)}****${cleaned.slice(-2)}`;
  }
  return phone;
}


// Generate compact bold M-Pesa receipt for 80mm thermal printers
export function generateMpesaReceiptHTML(data: ReceiptData, company: CompanyInfo = getCompanyInfo()): string {
  const maskedPhone = maskPhoneNumber(data.customerPhone || '');
  const totalItems = data.items.reduce((sum, item) => sum + item.qty, 0);

  const itemRows = data.items.map((item) => `
    <tr style="border-bottom:0.5px dashed #000;">
      <td style="padding:3px 0;font-size:10px;font-weight:700;">${item.name}</td>
      <td style="padding:3px 2px;text-align:center;font-size:10px;font-weight:700;">${item.qty}</td>
      <td style="padding:3px 0;text-align:right;font-size:10px;font-weight:700;">${item.price.toLocaleString()}</td>
      <td style="padding:3px 0;text-align:right;font-size:10px;font-weight:900;">${item.total.toLocaleString()}</td>
    </tr>
    ${(item.discount && item.discount > 0) ? `<tr><td colspan="3" style="padding:1px 0 2px 8px;font-size:9px;font-weight:700;">Disc</td><td style="text-align:right;font-size:9px;font-weight:700;">-${item.discount.toLocaleString()}</td></tr>` : ''}
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt - ${data.invoiceNo}</title>
  <style>
    @page { margin: 0; size: 80mm auto; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      font-weight: 700;
      width: 80mm;
      padding: 3mm;
      background: #fff;
      color: #000;
      line-height: 1.3;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .d { border:none; border-top:0.5px dashed #000; margin:3px 0; }
    .dt { border:none; border-top:1px solid #000; margin:3px 0; }
    .r { display:flex; justify-content:space-between; align-items:center; }
    .c { text-align:center; }
    @media print { body { width:80mm; } }
  </style>
</head>
<body>

  <div class="c">
    <div style="font-size:13px;font-weight:900;text-transform:uppercase;">${company.name}</div>
    <div style="font-size:8px;margin-top:2px;line-height:1.4;">
      ${company.address}<br>Tel: ${company.phone}
      ${company.email ? ` | ${company.email}` : ''}
      ${company.pin ? `<br>PIN: ${company.pin}` : ''}
    </div>
    ${company.slogan ? `<div style="font-size:7px;font-style:italic;margin-top:1px;">${company.slogan}</div>` : ''}
  </div>

  <hr class="dt">

  <div class="c" style="margin:3px 0;">
    <span style="background:#000;color:#fff;font-size:10px;font-weight:900;padding:2px 12px;letter-spacing:1px;">✓ M-PESA PAYMENT</span>
  </div>

  <hr class="d">

  <div class="r" style="margin:1px 0;"><span style="font-size:9px;">Receipt No</span><span style="font-weight:900;font-size:10px;">${data.invoiceNo}</span></div>
  <div class="r" style="margin:1px 0;"><span style="font-size:9px;">Date</span><span style="font-size:9px;">${data.date}  ${data.time}</span></div>
  <div class="r" style="margin:1px 0;"><span style="font-size:9px;">Served By</span><span style="font-size:9px;">${data.cashier}</span></div>
  ${data.customerName ? `<div class="r" style="margin:1px 0;"><span style="font-size:9px;">Customer</span><span style="font-weight:900;font-size:9px;">${data.customerName}</span></div>` : ''}

  <hr class="d">

  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr style="border-bottom:1px solid #000;">
        <th style="text-align:left;padding:2px 0;font-size:9px;font-weight:900;width:44%;">ITEM</th>
        <th style="text-align:center;padding:2px;font-size:9px;font-weight:900;width:10%;">QTY</th>
        <th style="text-align:right;padding:2px 0;font-size:9px;font-weight:900;width:22%;">PRICE</th>
        <th style="text-align:right;padding:2px 0;font-size:9px;font-weight:900;width:24%;">AMT</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <hr class="d">

  <div class="r" style="margin:1px 0;"><span style="font-size:9px;">Subtotal (${totalItems} items)</span><span style="font-size:10px;">${data.subtotal.toLocaleString()}</span></div>
  ${data.discount > 0 ? `<div class="r" style="margin:1px 0;"><span style="font-size:9px;">Discount</span><span style="font-size:10px;font-weight:900;">-${data.discount.toLocaleString()}</span></div>` : ''}
  ${data.tax > 0 ? `<div class="r" style="margin:1px 0;"><span style="font-size:9px;">VAT (16%)</span><span style="font-size:10px;">${data.tax.toLocaleString()}</span></div>` : ''}

  <div style="background:#000;color:#fff;padding:4px 6px;margin:3px 0;">
    <div class="r">
      <span style="font-size:11px;font-weight:900;">TOTAL</span>
      <span style="font-size:14px;font-weight:900;letter-spacing:1px;">KES ${data.total.toLocaleString()}</span>
    </div>
  </div>

  <hr class="d">

  <div style="border:1px solid #000;padding:5px;margin:3px 0;">
    <div class="c" style="font-size:8px;font-weight:900;letter-spacing:1px;text-transform:uppercase;">Payment Confirmation</div>
    ${data.mpesaReceipt ? `
    <div class="c" style="margin:3px 0;">
      <div style="font-size:7px;">M-PESA CODE</div>
      <div style="font-size:13px;font-weight:900;letter-spacing:2px;margin-top:1px;">${data.mpesaReceipt}</div>
    </div>
    <hr class="d">` : ''}
    <div class="r" style="margin:2px 0;"><span style="font-size:9px;">Amount Paid</span><span style="font-size:10px;font-weight:900;">KES ${data.amountPaid.toLocaleString()}</span></div>
    ${maskedPhone ? `<div class="r" style="margin:2px 0;"><span style="font-size:9px;">Phone</span><span style="font-size:10px;font-weight:900;letter-spacing:1px;">${maskedPhone}</span></div>` : ''}
    ${data.change > 0 ? `<div class="r" style="margin:2px 0;"><span style="font-size:9px;">Change</span><span style="font-size:10px;font-weight:900;">KES ${data.change.toLocaleString()}</span></div>` : ''}
    <div class="c" style="margin-top:3px;">
      <span style="border:1px solid #000;font-size:9px;font-weight:900;padding:2px 8px;">✓ PAID</span>
    </div>
  </div>

  <hr class="d">

  <div class="c" style="margin:3px 0;">
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=https://alpha-retail.vercel.app/verify/${encodeURIComponent(data.invoiceNo)}" alt="QR" style="width:50px;height:50px;"/>
    <div style="font-size:7px;margin-top:1px;">Scan to verify</div>
  </div>

  <hr class="d">

  <div class="c" style="padding:2px 0;">
    <div style="font-size:10px;font-weight:900;">★ THANK YOU! ★</div>
    <div style="font-size:8px;margin-top:2px;">Goods once sold are not refundable</div>
    <div style="font-size:7px;margin-top:2px;">Powered by Alpha Retail POS</div>
  </div>

</body>
</html>
`;
}

// Print M-Pesa receipt
export function printMpesaReceipt(data: ReceiptData, company?: CompanyInfo): void {
  const html = generateMpesaReceiptHTML(data, company);
  printReceipt(html);
}

export default {
  generateReceiptHTML,
  generateCustomerBillHTML,
  generateKOTHTML,
  generateMpesaReceiptHTML,
  printReceipt,
  printToThermalPrinter,
  createReceiptData,
  createKOTData,
  printCustomerReceipt,
  printKOT,
  printUnpaidBill,
  printMpesaReceipt,
  maskPhoneNumber
};

