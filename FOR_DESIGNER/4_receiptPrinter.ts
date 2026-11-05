// Thermal Receipt Printing Utilities — EXACT Alpha Retail Pattern
// Works with 58mm and 80mm thermal printers
// Adapted for Alpha Pharmacy: includes prescription notes (℞) on items

export interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
  total: number;
  notes?: string;       // prescription notes
  discount?: number;
  batchNumber?: string;
  expiryDate?: string;
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
  shiftCode?: string;
  isPaid?: boolean;
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

// Default company info
let cachedCompanyInfo: CompanyInfo | null = null;

const defaultCompanyInfo: CompanyInfo = {
  name: 'ALPHA PHARMACY',
  address: 'Main Street, Nairobi',
  phone: '+254 712 345 678',
  email: 'info@alphapharmacy.co.ke',
  pin: 'P051234567X',
  slogan: 'Your Health, Our Priority!'
};

// Load company info from database (pharmacy_organisation_settings table)
export async function loadCompanyInfo(): Promise<CompanyInfo> {
  if (cachedCompanyInfo) return cachedCompanyInfo;

  try {
    // First try localStorage cache
    const storedSettings = localStorage.getItem('pharmacy_company_settings');
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
        .from('pharmacy_organisation_settings')
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

        // Cache to localStorage
        localStorage.setItem('pharmacy_company_settings', JSON.stringify({
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

// Generate Customer Bill HTML — EXACT Alpha Retail layout with pharmacy prescription notes
export function generateCustomerBillHTML(data: ReceiptData, company: CompanyInfo = defaultCompanyInfo, isPaid: boolean = false): string {
  const itemRows = data.items.map((item, index) => `
    <tr>
      <td>${index + 1}. ${item.name}${item.batchNumber ? ` <span style="font-size:8px;color:#666;">[${item.batchNumber}]</span>` : ''}</td>
      <td>${item.qty}</td>
      <td>${item.price.toLocaleString()}</td>
      <td style="font-weight:bold;">${item.total.toLocaleString()}</td>
    </tr>
    ${item.notes ? `<tr><td colspan="4" style="font-size:9px;color:#c00;padding:1px 0 2px 12px;font-style:italic;">↳ ℞ ${item.notes}</td></tr>` : ''}
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
      max-width: 80mm;
      padding: 2mm;
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
      color: #000;
    }
    .company-details {
      font-size: 10px;
      color: #000;
      line-height: 1.4;
    }
    .slogan {
      font-size: 9px;
      font-style: italic;
      color: #000;
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
      padding: 4px 4px;
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
      color: #000;
      font-size: 10px;
    }
    .info-value {
      font-weight: bold;
      font-size: 11px;
      color: #000;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
      table-layout: fixed;
    }
    .items-table th {
      background: #eee;
      padding: 3px 2px;
      text-align: left;
      font-size: 9px;
      font-weight: bold;
      color: #000;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
    }
    .items-table td {
      font-size: 10px;
      padding: 2px 2px;
      border-bottom: 1px dotted #ccc;
      vertical-align: top;
      color: #000;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .items-table td:first-child { text-align: left; }
    .items-table td:nth-child(2) { text-align: center; white-space: nowrap; }
    .items-table td:nth-child(3) { text-align: right; white-space: nowrap; }
    .items-table td:nth-child(4) { text-align: right; white-space: nowrap; }
    .items-table th:nth-child(2) { text-align: center; }
    .items-table th:nth-child(3) { text-align: right; }
    .items-table th:nth-child(4) { text-align: right; }
    .totals-section {
      border-top: 1px solid #000;
      padding-top: 3px;
      margin-top: 2px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 1px 0;
      font-size: 11px;
      color: #000;
    }
    .grand-total {
      background: #000;
      color: #fff;
      padding: 5px 6px;
      margin: 2px 0;
      border-radius: 3px;
    }
    .grand-total .total-row {
      font-size: 14px;
      font-weight: bold;
      color: #fff;
    }
    .payment-section {
      background: #fff;
      border: 1px solid #000;
      padding: 6px;
      border-radius: 3px;
      margin: 4px 0;
    }
    .payment-section.unpaid {
      border-color: #000;
    }
    .payment-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
      color: #000;
      border: 1px solid #000;
    }
    .payment-badge.paid {
      background: #000;
      color: #fff;
    }
    .payment-badge.unpaid {
      background: #fff;
      color: #000;
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
      color: #000;
      margin-bottom: 2px;
    }
    .footer-note {
      font-size: 8px;
      color: #000;
      margin-top: 2px;
    }
    .powered-by {
      font-size: 7px;
      color: #000;
      margin-top: 3px;
    }
    @media print {
      body { width: 80mm; max-width: 80mm; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  ${watermarkStyle}

  <!-- Header -->
  <div class="header">
    <div class="company-logo">💊</div>
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
  <div style="display:flex;align-items:center;gap:4px;padding:4px;background:#f5f5f5;border-radius:3px;margin:4px 0;overflow:hidden;">
    <div style="flex:1;min-width:0;">
      <div style="margin-bottom:3px;"><span style="font-size:8px;color:#000;">Invoice No:</span><br/><span style="font-size:10px;font-weight:bold;color:#000;">${data.invoiceNo}</span></div>
      <div><span style="font-size:8px;color:#000;">Time:</span><br/><span style="font-size:9px;font-weight:bold;color:#000;">${data.time}</span></div>
    </div>
    <div style="text-align:center;flex-shrink:0;">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=${encodeURIComponent(data.invoiceNo + '|' + company.name + '|Ksh' + data.total + '|' + data.date)}" 
        style="width:45px;height:45px;display:block;" alt="QR" />
    </div>
    <div style="flex:1;min-width:0;text-align:right;">
      <div style="margin-bottom:3px;"><span style="font-size:8px;color:#000;">Date:</span><br/><span style="font-size:9px;font-weight:bold;color:#000;">${data.date}</span></div>
      <div><span style="font-size:8px;color:#000;">Pharmacist:</span><br/><span style="font-size:9px;font-weight:bold;color:#000;">${data.cashier}</span></div>
    </div>
  </div>

  ${data.customerName ? `
  <div style="text-align:center;margin:5px 0;">
    <span style="font-size:12px;color:#000;">👤 Customer: <strong>${data.customerName}</strong></span>
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
    <div class="total-row">
      <span>Discount:</span>
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
      <span style="font-weight:bold;font-size:12px;color:#000;">
        ${isPaid ? data.paymentMethod.toUpperCase() : 'PENDING'}
      </span>
    </div>
    ${isPaid ? `
    <div style="margin-top:8px;font-size:11px;">
      <div class="total-row">
        <span>Amount Paid:</span>
        <span style="font-weight:bold;">Ksh ${data.amountPaid.toLocaleString()}</span>
      </div>
      ${data.change > 0 ? `
      <div class="total-row" style="font-weight:bold;">
        <span>Change:</span>
        <span>Ksh ${data.change.toLocaleString()}</span>
      </div>
      ` : ''}
      ${data.mpesaReceipt ? `
      <div class="total-row" style="font-size:10px;">
        <span>M-Pesa Ref:</span>
        <span style="font-weight:bold;">${data.mpesaReceipt}</span>
      </div>
      ` : ''}
    </div>
    ` : `
    <div style="margin-top:8px;text-align:center;font-size:11px;color:#000;font-weight:bold;">
      Please pay at the counter
    </div>
    `}
  </div>

  <!-- Receipt No -->
  <div style="text-align:center;margin:4px 0 2px 0;padding:2px 0;border-top:1px dashed #ccc;">
    <div style="font-size:9px;font-weight:bold;letter-spacing:1px;">${data.invoiceNo}</div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="thank-you">★ THANK YOU FOR SHOPPING WITH US! ★</div>
    <div style="font-size:10px;color:#000;">Your Health, Our Priority</div>
    <div class="footer-note">
      ${isPaid ? 'This serves as your official tax invoice' : 'This is not a tax invoice until payment is complete'}
    </div>
    <div class="footer-note">
      Goods once sold are not refundable
    </div>
    <div class="powered-by">
      Powered by Alpha Pharmacy POS v1.0
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

// Print function - uses iframe to avoid popup blockers
export function printReceipt(html: string): void {
  console.log('🖨️ Printing receipt...');
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

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          console.log('🖨️ Print dialog opened');
        } catch (e) {
          console.error('Print error:', e);
        }
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

// Generate receipt data from cart
export function createReceiptData(
  invoiceNo: string,
  items: { name: string; qty: number; price: number; notes?: string; discount?: number; batchNumber?: string; expiryDate?: string }[],
  paymentMethod: string,
  amountPaid: number,
  cashier: string,
  options?: {
    customerName?: string;
    customerPhone?: string;
    mpesaReceipt?: string;
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
      discount: item.discount,
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate,
    })),
    subtotal,
    discount: totalDiscount,
    tax: options?.tax || 0,
    total,
    paymentMethod,
    amountPaid,
    change,
    customerName: options?.customerName,
    customerPhone: options?.customerPhone,
    mpesaReceipt: options?.mpesaReceipt,
    shiftCode: options?.shiftCode,
    isPaid: options?.isPaid ?? true
  };
}

// Print customer receipt (paid)
export function printCustomerReceipt(data: ReceiptData, company?: CompanyInfo): void {
  const html = generateReceiptHTML(data, company);
  printReceipt(html);
}

// Print unpaid customer bill (with NOT PAID watermark)
export function printUnpaidBill(data: ReceiptData, company?: CompanyInfo): void {
  const html = generateCustomerBillHTML(data, company, false);
  printReceipt(html);
}

// Mask phone number for privacy
export function maskPhoneNumber(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('254') && cleaned.length >= 12) {
    return `${cleaned.slice(0, 6)}****${cleaned.slice(-2)}`;
  }
  if (cleaned.length >= 10) {
    return `${cleaned.slice(0, 4)}****${cleaned.slice(-2)}`;
  }
  return phone;
}

export default {
  generateReceiptHTML,
  generateCustomerBillHTML,
  printReceipt,
  createReceiptData,
  printCustomerReceipt,
  printUnpaidBill,
  loadCompanyInfo,
  getCompanyInfo,
  maskPhoneNumber
};
