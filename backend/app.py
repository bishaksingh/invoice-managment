from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from excel_generator import create_invoice_excel

app = Flask(__name__)
CORS(app)

# ✅ MAIN API (USED BY FRONTEND)
@app.route('/generate-excel', methods=['POST'])
def generate_excel():
    try:
        data = request.get_json()

        if not data:
            return jsonify({"error": "No data received"}), 400

        print("DATA RECEIVED:", data)

        file_path = create_invoice_excel(data)

        return send_file(
            file_path,
            as_attachment=True,
            download_name="Invoice.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

    except Exception as e:
        print("ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


# ✅ OPTIONAL TEST ROUTE (KEEP FOR DEBUG)
@app.route('/test-excel')
def test_excel():
    data = {
        "company": "RAHUL SERVICES",
        "address": "Kolkata, India",
        "gstNo": "123456",
        "phoneNo": "9999999999",
        "invoiceDate": "2026-05-02",
        "items": [
            {
                "description": "AC Repair",
                "quantity": 2,
                "unitPrice": 500,
                "hsnCode": "9987"
            }
        ]
    }

    file_path = create_invoice_excel(data)

    return send_file(
        file_path,
        as_attachment=True,
        download_name="Invoice.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


if __name__ == '__main__':
    app.run(debug=True)