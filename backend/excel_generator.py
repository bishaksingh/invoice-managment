from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import os
import re


# Built-in number to words — replaces num2words (no install needed)
def num2words_inr(n):
    ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN',
            'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN',
            'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN']
    tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY',
            'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY']

    def below_1000(num):
        if num == 0:
            return ''
        elif num < 20:
            return ones[num]
        elif num < 100:
            return tens[num // 10] + (('-' + ones[num % 10]) if num % 10 else '')
        else:
            return ones[num // 100] + '-HUNDRED' + (('-' + below_1000(num % 100)) if num % 100 else '')

    if n == 0:
        return 'ZERO'
    parts = []
    if n >= 10000000:
        parts.append(below_1000(n // 10000000) + '-CRORE')
        n %= 10000000
    if n >= 100000:
        parts.append(below_1000(n // 100000) + '-LAKH')
        n %= 100000
    if n >= 1000:
        parts.append(below_1000(n // 1000) + '-THOUSAND')
        n %= 1000
    if n > 0:
        parts.append(below_1000(n))
    return '-'.join(parts)


def create_invoice_excel(data):
    """
    Fully Dynamic Invoice Generator.
    All data comes from backend via 'data' dictionary.
    Layout is IDENTICAL to original — only data population is fixed.

    Fixes applied vs original:
      1. Supports 'unitPrice' key (backend) in addition to 'rate'
      2. Replaced num2words library with built-in Indian number-to-words
      3. Cleans markdown links in serialNote  e.g. [SL.NO](http://...) -> SL.NO
      4. round_off calculated automatically
      5. Supports 'stateName' key in addition to 'state'
      6. Supports 'address' key in addition to 'company_address'
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "Invoice"

    # ====================== STYLES ======================
    bold_font = Font(bold=True, size=11)
    big_bold = Font(bold=True, size=14)
    center_align = Alignment(horizontal='center', vertical='center', wrap_text=True)
    left_align = Alignment(horizontal='left', vertical='top', wrap_text=True)

    thin = Side(style='thin')
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    # ====================== COLUMN WIDTHS ======================
    column_widths = [5, 3, 30, 18, 8, 10, 15, 12, 12, 15]
    for i, width in enumerate(column_widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = width

    row = 4   # Top 3 rows blank

    # ====================== HEADER ======================
    ws.merge_cells(f'B{row}:J{row}')
    ws[f'B{row}'] = data.get('company', '')
    ws[f'B{row}'].font = big_bold
    ws[f'B{row}'].alignment = center_align
    row += 1

    ws.merge_cells(f'B{row}:J{row}')
    ws[f'B{row}'] = data.get('company_address', data.get('address', ''))
    ws[f'B{row}'].alignment = center_align
    row += 1

    # GST, Phone, Date
    ws.merge_cells(f'B{row}:F{row}')
    ws[f'B{row}'] = f"GST NO : {data.get('gstNo', '')}   Phone No: {data.get('phoneNo', '')}"
    ws[f'B{row}'].alignment = left_align

    ws.merge_cells(f'G{row}:J{row}')
    ws[f'G{row}'] = f"DATE: {data.get('invoiceDate', '')}"
    ws[f'G{row}'].alignment = center_align
    row += 1

    # ====================== INVOICE DETAILS ======================
    # Left side
    ws.merge_cells(f'B{row}:F{row}')
    ws[f'B{row}'] = f"INVOICE NO: {data.get('invoiceNumber', data.get('invoiceNo', data.get('invNumber', '')))}"
    ws[f'B{row}'].alignment = left_align
    row += 1

    ws.merge_cells(f'B{row}:F{row}')
    ws[f'B{row}'] = f"REVERSE CHARGE: {data.get('reverseCharge', '')}"
    ws[f'B{row}'].alignment = left_align
    row += 1

    ws.merge_cells(f'B{row}:F{row}')
    ws[f'B{row}'] = f"INVOICE DATE: {data.get('invoiceDate', '')}"
    ws[f'B{row}'].alignment = left_align
    row += 1

    ws.merge_cells(f'B{row}:F{row}')
    ws[f'B{row}'] = f"STATE : {data.get('stateName', data.get('state', ''))}   STATE CODE : {data.get('stateCode', '')}"
    ws[f'B{row}'].alignment = left_align
    row += 1

    # Right side (fills same 4 rows as left side above)
    ws.merge_cells(f'G{row-4}:J{row-4}')
    ws[f'G{row-4}'] = f"TRANSPORT BY : {data.get('transportBy', '')}"
    ws[f'G{row-4}'].alignment = left_align

    ws.merge_cells(f'G{row-3}:J{row-3}')
    ws[f'G{row-3}'] = f"VEHICLE NO: {data.get('vehicleNo', '')}"
    ws[f'G{row-3}'].alignment = left_align

    ws.merge_cells(f'G{row-2}:J{row-2}')
    ws[f'G{row-2}'] = f"DATE OF DELIVERY: {data.get('deliveryDate', '')}"
    ws[f'G{row-2}'].alignment = left_align

    ws.merge_cells(f'G{row-1}:J{row-1}')
    ws[f'G{row-1}'] = f"PLACE OF DELIVERY: {data.get('placeOfDelivery', '')}"
    ws[f'G{row-1}'].alignment = left_align

    # ====================== BILL TO ======================
    row += 1
    ws.merge_cells(f'B{row}:F{row}')
    ws[f'B{row}'] = "DETAILS OF RECEIVER / BILLED TO"
    ws[f'B{row}'].alignment = left_align
    ws[f'B{row}'].font = bold_font
    row += 1

    customer = data.get('customer', {})
    ws.merge_cells(f'B{row}:F{row}')
    ws[f'B{row}'] = f"NAME : {customer.get('name', '')}"
    ws[f'B{row}'].alignment = left_align
    row += 1

    ws.merge_cells(f'B{row}:F{row}')
    ws[f'B{row}'] = f"TR NO : {customer.get('trNo', '')}"
    ws[f'B{row}'].alignment = left_align
    row += 1

    ws.merge_cells(f'B{row}:F{row}')
    ws[f'B{row}'] = f"ADDRESS : {customer.get('address', '')}"
    ws[f'B{row}'].alignment = left_align
    row += 1

    ws.merge_cells(f'B{row}:F{row}')
    ws[f'B{row}'] = f"GST NO : {customer.get('gstNo', '')}   STATE CODE : {customer.get('stateCode', '')}"
    ws[f'B{row}'].alignment = left_align
    row += 1

    # ====================== CONSIGNEE ======================
    consignee = data.get('consignee', {})
    ws.merge_cells(f'G{row-4}:J{row-4}')
    ws[f'G{row-4}'] = "DETAILS OF CONSIGNEE / SHIPPED TO"
    ws[f'G{row-4}'].alignment = left_align
    ws[f'G{row-4}'].font = bold_font

    ws.merge_cells(f'G{row-3}:J{row-3}')
    ws[f'G{row-3}'] = f"NAME: {consignee.get('name', '')}"
    ws[f'G{row-3}'].alignment = left_align

    ws.merge_cells(f'G{row-2}:J{row-2}')
    ws[f'G{row-2}'] = f"ADDRESS: {consignee.get('address', '')}"
    ws[f'G{row-2}'].alignment = left_align

    ws.merge_cells(f'G{row-1}:J{row-1}')
    ws[f'G{row-1}'] = f"GST NO : {consignee.get('gstNo', '')}   STATE CODE : {consignee.get('stateCode', '')}"
    ws[f'G{row-1}'].alignment = left_align

    # ====================== TABLE HEADER ======================
    row += 1
    headers = ["SL NO", "PARTICULARS", "HSN /SAC CODE", "QTY", "RATE", "AMOUNT", "CGST 09%", "SGST 09%", "TOTAL"]
    for col, header in enumerate(headers, start=2):
        cell = ws.cell(row=row, column=col)
        cell.value = header
        cell.font = bold_font
        cell.alignment = center_align
        cell.border = border

    # ====================== ITEMS ======================
    items = data.get('items', [])
    subtotal = cgst_total = sgst_total = 0.0

    for i, item in enumerate(items, start=1):
        row += 1
        qty = float(item.get('quantity', 0))
        # FIX: support both 'rate' (original) and 'unitPrice' (backend sends)
        rate = float(item.get('rate', item.get('unitPrice', 0)))
        amount = qty * rate
        cgst = amount * 0.09
        sgst = amount * 0.09
        total = amount + cgst + sgst

        subtotal += amount
        cgst_total += cgst
        sgst_total += sgst

        ws.cell(row=row, column=2, value=i)
        ws.cell(row=row, column=3, value=item.get('description', ''))
        ws.cell(row=row, column=4, value=item.get('hsnCode', ''))
        ws.cell(row=row, column=5, value=f"{qty} nos.")
        ws.cell(row=row, column=6, value=rate)
        ws.cell(row=row, column=7, value=round(amount, 2))
        ws.cell(row=row, column=8, value=round(cgst, 2))
        ws.cell(row=row, column=9, value=round(sgst, 2))
        ws.cell(row=row, column=10, value=round(total, 2))

        if item.get('serialNote'):
            row += 1
            ws.merge_cells(f'B{row}:J{row}')
            # FIX: clean markdown links e.g. [SL.NO](http://SL.NO) -> SL.NO
            serial_clean = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', item.get('serialNote', ''))
            ws[f'B{row}'] = serial_clean

    # Final Calculations
    grand_total = subtotal + cgst_total + sgst_total
    discount = float(data.get('discount', 0))
    # FIX: auto-calculate round off
    round_off = round(round(grand_total - discount) - (grand_total - discount), 2)
    final_total = round(grand_total - discount + round_off, 2)

    # ====================== TOTALS & WORDS ======================
    row += 1
    ws.merge_cells(f'B{row}:F{row}')
    ws[f'B{row}'] = "TOTAL"
    ws[f'J{row}'] = round(grand_total, 2)

    row += 1
    ws.merge_cells(f'B{row}:F{row}')
    ws[f'B{row}'] = "TOTAL INVOICE AMOUNT IN WORDS"
    ws[f'B{row}'].font = bold_font

    row += 1
    # FIX: use built-in num2words_inr instead of num2words library
    words = num2words_inr(int(round(final_total)))
    ws.merge_cells(f'B{row}:J{row}')
    ws[f'B{row}'] = f"RUPEES-{words} ONLY."

    row += 1
    ws.merge_cells(f'G{row}:I{row}')
    ws[f'G{row}'] = "DISCOUNT AMOUNT"
    ws[f'J{row}'] = round(discount, 2)

    row += 1
    ws.merge_cells(f'G{row}:I{row}')
    ws[f'G{row}'] = "ROUND OFF (-)"
    ws[f'J{row}'] = round_off

    row += 1
    ws.merge_cells(f'G{row}:I{row}')
    ws[f'G{row}'] = "TOTAL AMOUNT AFTER TAX"
    ws[f'J{row}'] = round(final_total, 2)

    # Signature
    row += 2
    ws.merge_cells(f'B{row}:J{row}')
    ws[f'B{row}'] = f"FOR {data.get('company', '')}"
    ws[f'B{row}'].alignment = left_align

    # ====================== BORDERS ======================
    for r in range(4, ws.max_row + 1):
        for c in range(2, 11):
            ws.cell(row=r, column=c).border = border

    # Save
    file_path = os.path.abspath("RAHUL_SERVICES_INVOICE.xlsx")
    wb.save(file_path)
    return file_path


# ====================== SAMPLE DATA ======================
if __name__ == "__main__":
    data = {
        'invoiceDate':     '2026-04-08',
        'invoiceNo':       'INV/2026/0001',
        'gstNo':           '19APIPS1842M1ZA',
        'phoneNo':         '9002444977',
        'reverseCharge':   'NO',
        'stateName':       'WEST BENGAL',
        'stateCode':       '19',
        'transportBy':     'OWN',
        'vehicleNo':       'WB40V2921',
        'deliveryDate':    '2026-05-08',
        'placeOfDelivery': 'UKHRA',
        'discount':        0,
        'company':         'RAHUL SERVICE',
        'address':         'Pashupati Market,Opp- Bank of Baroda, Benachity,Durgapur-713213',

        'customer': {
            'name':      'UBO GOSTHI CLUB C/O PRASENJIT PALIT',
            'trNo':      '200',
            'address':   'PALASDIHA,NEAR PALASDIHA MARKET.DURGAPUR, PIN -713208',
            'gstNo':     '172475A5452',
            'state':     'west bengal',
            'stateCode': '713363',
        },

        'consignee': {
            'name':      'Bishak singh',
            'address':   'ukhra',
            'gstNo':     '5584As848',
            'stateCode': '25815',
        },

        'items': [
            {
                'description': '2 NOS. SPLIT MIDEA AC',
                'hsnCode':     '8145010',
                'quantity':    2,
                'unitPrice':   25420,
                'tax':         18,
                'serialNote':  '1. IDU SL.NO-50992205267003934.ODU SL.NO-50992304267002259',
            },
            {
                'description': '2 NOS. SPLIT AC',
                'hsnCode':     '852741',
                'quantity':    1,
                'unitPrice':   52840,
                'tax':         18,
                'serialNote':  '50992205267003934',
            },
        ],
    }

    path = create_invoice_excel(data)
    print(f"Invoice saved: {path}")