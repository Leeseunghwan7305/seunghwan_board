import fitz  # PyMuPDF

doc = fitz.open()
p1 = doc.new_page()
p1.insert_text((72, 72), "Refunds are available within 30 days of purchase.")
p2 = doc.new_page()
p2.insert_text((72, 72), "Shipping takes 2 business days.")
doc.save("backend/tests/fixtures/sample.pdf")
