
from pathlib import Path
import pandas as pd

file_path = Path("data/sales_data.csv")
df = pd.read_csv(file_path)

print("\nFirst 5 rows:")
print(df.head())

print("\nDataset information:")
print(df.info())

print("\nColumn names:")
print(df.columns.tolist())

print("\nTotal revenue: ₹{:,.2f}".format(df["revenue"].sum()))
print("Total orders:", df["order_id"].nunique())
print("Unique customers:", df["customer_id"].nunique())
