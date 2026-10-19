
from pathlib import Path

import pandas as pd
from flask import Flask, jsonify, render_template, request, send_file

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data" / "sales_data.csv"


def load_data():
    """Load and validate the sales dataset."""
    if not DATA_FILE.exists():
        raise FileNotFoundError(
            "Sales dataset not found. Run: python data/generate_data.py"
        )

    df = pd.read_csv(DATA_FILE)
    df["order_date"] = pd.to_datetime(df["order_date"], errors="coerce")
    df = df.dropna(subset=["order_date", "revenue", "quantity"])

    return df


def get_filtered_data():
    """Apply optional dashboard filters."""
    df = load_data()

    category = request.args.get("category", "All")
    region = request.args.get("region", "All")
    channel = request.args.get("channel", "All")
    start_date = request.args.get("start_date", "")
    end_date = request.args.get("end_date", "")

    if category != "All":
        df = df[df["category"] == category]

    if region != "All":
        df = df[df["region"] == region]

    if channel != "All":
        df = df[df["sales_channel"] == channel]

    if start_date:
        df = df[df["order_date"] >= pd.to_datetime(start_date)]

    if end_date:
        df = df[df["order_date"] <= pd.to_datetime(end_date)]

    return df


def get_previous_period_data():
    """Compare selected dates with the immediately preceding period."""
    current_df = get_filtered_data()

    if current_df.empty:
        return current_df, load_data().iloc[0:0]

    start_date = request.args.get("start_date", "")
    end_date = request.args.get("end_date", "")

    period_start = (
        pd.to_datetime(start_date).normalize()
        if start_date
        else current_df["order_date"].min().normalize()
    )

    period_end = (
        pd.to_datetime(end_date).normalize()
        if end_date
        else current_df["order_date"].max().normalize()
    )

    period_days = max((period_end - period_start).days + 1, 1)
    previous_end = period_start - pd.Timedelta(days=1)
    previous_start = previous_end - pd.Timedelta(days=period_days - 1)

    previous_df = load_data()

    # Apply the same non-date filters.
    category = request.args.get("category", "All")
    region = request.args.get("region", "All")
    channel = request.args.get("channel", "All")

    if category != "All":
        previous_df = previous_df[previous_df["category"] == category]

    if region != "All":
        previous_df = previous_df[previous_df["region"] == region]

    if channel != "All":
        previous_df = previous_df[previous_df["sales_channel"] == channel]

    previous_df = previous_df[
        (previous_df["order_date"] >= previous_start)
        & (previous_df["order_date"] < previous_end + pd.Timedelta(days=1))
    ]

    return current_df, previous_df


def calculate_growth(current, previous):
    """Return percentage growth when previous-period data is available."""
    if previous is None or previous <= 0:
        return None

    return round(((current - previous) / previous) * 100, 2)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/filters")
def filters():
    df = load_data()

    return jsonify({
        "categories": sorted(df["category"].dropna().unique().tolist()),
        "regions": sorted(df["region"].dropna().unique().tolist()),
        "channels": sorted(df["sales_channel"].dropna().unique().tolist()),
        "min_date": df["order_date"].min().strftime("%Y-%m-%d"),
        "max_date": df["order_date"].max().strftime("%Y-%m-%d"),
    })



@app.route("/api/summary")
def summary():
    current_df, previous_df = get_previous_period_data()

    def get_metrics(df):
        revenue = float(df["revenue"].sum())
        orders = int(df["order_id"].nunique())
        units = int(df["quantity"].sum())
        customers = int(df["customer_id"].nunique())

        return {
            "total_revenue": round(revenue, 2),
            "total_orders": orders,
            "units_sold": units,
            "unique_customers": customers,
            "average_order_value": round(revenue / orders, 2) if orders else 0,
        }

    current = get_metrics(current_df)
    previous = get_metrics(previous_df)

    
    has_previous_data = not previous_df.empty

    growth = {
        key: calculate_growth(current[key], previous[key])
        if has_previous_data else None
        for key in current
    }


    return jsonify({
        **current,
        "previous_period": previous,
        "growth": growth,
    })



@app.route("/api/sales-trend")
def sales_trend():
    df = get_filtered_data()

    if df.empty:
        return jsonify({"labels": [], "revenue": [], "orders": []})

    monthly = (
        df.assign(month=df["order_date"].dt.to_period("M").astype(str))
        .groupby("month")
        .agg(revenue=("revenue", "sum"), orders=("order_id", "nunique"))
        .reset_index()
        .sort_values("month")
    )

    return jsonify({
        "labels": monthly["month"].tolist(),
        "revenue": monthly["revenue"].round(2).tolist(),
        "orders": monthly["orders"].tolist(),
    })


@app.route("/api/category-sales")
def category_sales():
    df = get_filtered_data()

    data = (
        df.groupby("category")["revenue"]
        .sum()
        .sort_values(ascending=False)
    )

    return jsonify({
        "labels": data.index.tolist(),
        "values": data.round(2).tolist(),
    })


@app.route("/api/region-sales")
def region_sales():
    df = get_filtered_data()

    data = (
        df.groupby("region")["revenue"]
        .sum()
        .sort_values(ascending=False)
    )

    return jsonify({
        "labels": data.index.tolist(),
        "values": data.round(2).tolist(),
    })


@app.route("/api/top-products")
def top_products():
    df = get_filtered_data()

    data = (
        df.groupby("product")
        .agg(
            revenue=("revenue", "sum"),
            units_sold=("quantity", "sum"),
            orders=("order_id", "nunique"),
        )
        .reset_index()
        .sort_values("revenue", ascending=False)
        .head(10)
    )

    return jsonify(data.round(2).to_dict(orient="records"))


@app.route("/api/top-customers")
def top_customers():
    df = get_filtered_data()

    data = (
        df.groupby("customer_id")
        .agg(
            total_spent=("revenue", "sum"),
            orders=("order_id", "nunique"),
            units_bought=("quantity", "sum"),
        )
        .reset_index()
        .sort_values("total_spent", ascending=False)
        .head(10)
    )

    return jsonify(data.round(2).to_dict(orient="records"))





@app.route("/api/customer-intelligence")
def customer_intelligence():
    df = get_filtered_data()

    if df.empty:
        return jsonify({
            "total_customers": 0,
            "repeat_customers": 0,
            "repeat_purchase_rate": 0,
            "average_spend_per_customer": 0,
            "customers": []
        })

    customer_data = (
        df.groupby("customer_id")
        .agg(
            total_spent=("revenue", "sum"),
            orders=("order_id", "nunique"),
            units_bought=("quantity", "sum")
        )
        .reset_index()
        .sort_values("total_spent", ascending=False)
    )

    total_customers = len(customer_data)
    repeat_customers = int((customer_data["orders"] > 1).sum())

    repeat_purchase_rate = (
        round((repeat_customers / total_customers) * 100, 2)
        if total_customers else 0
    )

    average_spend = (
        round(customer_data["total_spent"].mean(), 2)
        if total_customers else 0
    )

    return jsonify({
        "total_customers": total_customers,
        "repeat_customers": repeat_customers,
        "repeat_purchase_rate": repeat_purchase_rate,
        "average_spend_per_customer": average_spend,
        "customers": customer_data.head(10).round(2).to_dict(orient="records")
    })








@app.route("/api/insights")
def insights():
    df = get_filtered_data()

    if df.empty:
        return jsonify({"insights": ["No sales records match these filters."]})

    category_sales = df.groupby("category")["revenue"].sum()
    region_sales = df.groupby("region")["revenue"].sum()
    product_sales = df.groupby("product")["revenue"].sum()

    best_category = category_sales.idxmax()
    best_region = region_sales.idxmax()
    best_product = product_sales.idxmax()

    insights_list = [
        f"{best_category} is the highest-revenue category in the selected data.",
        f"{best_region} generates the highest regional revenue in the selected data.",
        f"{best_product} is the top product by revenue in the selected data.",
        f"The selected records contain {df['order_id'].nunique()} unique orders.",
    ]

    return jsonify({"insights": insights_list})


@app.route("/api/export")
def export_csv():
    df = get_filtered_data()

    # Format the date column correctly
    if "order_date" in df.columns:
        df["order_date"] = pd.to_datetime(
            df["order_date"], errors="coerce"
        ).dt.strftime("%Y-%m-%d")

    export_file = BASE_DIR / "data" / "filtered_sales_export.csv"

    # Save the filtered data without an extra index column
    df.to_csv(export_file, index=False)

    return send_file(
        export_file,
        as_attachment=True,
        download_name="filtered_sales_data.csv",
        mimetype="text/csv",
    )



@app.route("/api/health")
def health():
    try:
        df = load_data()
        return jsonify({
            "status": "ok",
            "dataset_rows": len(df),
            "dataset_columns": len(df.columns),
        })
    except Exception as exc:
        return jsonify({"status": "error", "message": str(exc)}), 500


if __name__ == "__main__":
    app.run(debug=True)
