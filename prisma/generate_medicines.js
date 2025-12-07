const fs = require("fs");
const path = require("path");

const base = [
  "Paracetamol", "Ibuprofen", "Amoxicillin", "Azithromycin", "Cetirizine",
  "Levocetirizine", "Metformin", "Glimepiride", "Atorvastatin",
  "Rosuvastatin", "Aspirin", "Clopidogrel", "Atenolol", "Amlodipine",
  "Losartan", "Rabeprazole", "Pantoprazole", "Omeprazole", "Domperidone",
  "Ondansetron", "Ciprofloxacin", "Doxycycline", "Fluconazole",
  "Metronidazole", "Salbutamol", "Montelukast", "Levothyroxine",
  "Hydrocortisone"
];

const strengths = [
  "50mg", "100mg", "200mg", "250mg", "500mg", "5mg", "10mg", "20mg",
  "40mg", "75mg"
];

const forms = ["Tablet", "Capsule", "Syrup", "Ointment", "Cream"];

function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const medicines = [];

for (let i = 1; i <= 2000; i++) {
  medicines.push({
    name: `${random(base)} ${random(strengths)} ${random(forms)}`,
    sku: `MED-${String(i).padStart(5, "0")}`,
    category: "NON_RX",
    rxType: "NONE",
    createdAt: new Date().toISOString(),
  });
}

fs.writeFileSync(
  path.join(__dirname, "medicines.json"),
  JSON.stringify(medicines, null, 2)
);

console.log("✅ Generated prisma/medicines.json (2000 items)");
