
import random
from pathlib import Path

import pandas as pd

random.seed(42)

# Find the project folder and data folder
DATA_DIR = Path(__file__).resolve().parent

products = {
    "Laptop": ("Electronics", 55000),
    "Headphones": ("Electronics", 2500),
    "Smartphone": ("Electronics", 22000),
    "T-Shirt": ("Fashion", 800),
    "Jeans": ("Fashion", 1800),
    "Sneakers": ("Fashion", 3200),
    "Coffee Maker": ("Home & Kitchen", 4500),
    "Backpack": ("Accessories", 1500),
    "Watch": ("Accessories", 2800),
    "Novel": ("Books", 450),
}

regions = ["North", "South", "East", "West", "Central"]
payment_methods = ["UPI", "Credit Card", "Debit Card", "Cash on Delivery"]
sales_channels = ["Website", "Mobile App"]

rows = []

# Generate 500 reproducible sample orders
for i in range(1, 501):
    product = random.choice(list(products.keys()))
    category, base_price = products[product]

    quantity = random.randint(1, 4)
    unit_price = round(base_price * random.uniform(0.90, 1.10), 2)

    rows.append({
        "order_id": f"ORD{i:04d}",
        "order_date": (
            pd.Timestamp("2025-01-01")
            + pd.Timedelta(days=random.randint(0, 364))
        ).strftime("%Y-%m-%d"),
        "customer_id": f"CUST{random.randint(1, 120):03d}",
        "product": product,
        "category": category,
        "quantity": quantity,
        "unit_price": unit_price,
        "revenue": round(quantity * unit_price, 2),
        "region": random.choice(regions),
        "payment_method": random.choice(payment_methods),
        "sales_channel": random.choice(sales_channels),
    })

df = pd.DataFrame(rows)

# Basic data validation and cleaning
df = df.drop_duplicates(subset=["order_id"])
df["order_date"] = pd.to_datetime(df["order_date"])
df = df.dropna()

output_file = DATA_DIR / "sales_data.csv"
df.to_csv(output_file, index=False)

print("Dataset created successfully!")
print("Rows and columns:", df.shape)
print("Missing values:", int(df.isnull().sum().sum()))
print("Unique orders:", df["order_id"].nunique())
print("Total sample revenue: ₹{:,.2f}".format(df["revenue"].sum()))
print("Saved to:", output_file)
