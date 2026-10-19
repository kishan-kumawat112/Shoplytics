
const $ = (id) => document.getElementById(id);

const money = (value) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0
    }).format(value || 0);

const number = (value) =>
    new Intl.NumberFormat("en-IN").format(value || 0);



function growthText(value) {
    if (value === null || value === undefined) {
        return "No comparison available";
    }

    const percentage = Number(value);

    if (!Number.isFinite(percentage)) {
        return "No comparison available";
    }

    if (percentage > 0) {
        return `↑ ${percentage.toFixed(2)}% vs previous period`;
    }

    if (percentage < 0) {
        return `↓ ${Math.abs(percentage).toFixed(2)}% vs previous period`;
    }

    return "— 0.00% vs previous period";
}








let trendChart, categoryChart, regionChart, productIntelligenceChart;

async function api(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Request failed: ${url}`);
    return response.json();
}

function filterQuery() {
    const params = new URLSearchParams();

    ["category", "region", "channel", "startDate", "endDate"].forEach((id) => {
        const value = $(id).value;
        if (value && value !== "All") {
            const key = {
                startDate: "start_date",
                endDate: "end_date"
            }[id] || id;
            params.set(key, value);
        }
    });

    return params.toString();
}

function filteredUrl(endpoint) {
    const query = filterQuery();
    return endpoint + (query ? `?${query}` : "");
}

function setStatus(message, isError = false) {
    $("status").textContent = message;
    $("status").classList.toggle("error", isError);
}

function fillSelect(id, values) {
    const select = $(id);
    const oldValue = select.value;

    values.forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });

    if (values.includes(oldValue)) select.value = oldValue;
}

function chartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: { color: "#aab6d0", usePointStyle: true }
            }
        },
        scales: {
            x: {
                ticks: { color: "#8e9bb8" },
                grid: { color: "#26314a" }
            },
            y: {
                ticks: { color: "#8e9bb8" },
                grid: { color: "#26314a" },
                beginAtZero: true
            }
        }
    };
}

function renderChart(existing, canvasId, config) {
    if (existing) existing.destroy();
    return new Chart($(canvasId), config);
}

async function loadDashboard() {
    try {
        setStatus("Loading sales data...");

        const query = filterQuery();
        const suffix = query ? `?${query}` : "";

                
        const [
            summary,
            trend,
            categories,
            regions,
            products,
            customers,
            customerIntelligence,
            insights
        ] = await Promise.all([
            api(`/api/summary${suffix}`),
            api(`/api/sales-trend${suffix}`),
            api(`/api/category-sales${suffix}`),
            api(`/api/region-sales${suffix}`),
            api(`/api/top-products${suffix}`),
            api(`/api/top-customers${suffix}`),
            api(`/api/customer-intelligence${suffix}`),
            api(`/api/insights${suffix}`)
        ]);


        
$("revenue").textContent = money(summary.total_revenue);
$("orders").textContent = number(summary.total_orders);
$("units").textContent = number(summary.units_sold);
$("customers").textContent = number(summary.unique_customers);
$("aov").textContent = money(summary.average_order_value);



// Customer Intelligence KPI cards
    $("ciTotalCustomers").textContent =
        number(customerIntelligence.total_customers);

    $("ciRepeatCustomers").textContent =
        number(customerIntelligence.repeat_customers);

    $("ciRepeatRate").textContent =
        `${customerIntelligence.repeat_purchase_rate.toFixed(2)}%`;

    // Customer Intelligence table
    const customerTable = $("customerIntelligenceTable");

    if (customerIntelligence.customers.length === 0) {
        customerTable.innerHTML = `
            <tr>
                <td colspan="4">No customer data available.</td>
            </tr>
        `;
    } else {
        customerTable.innerHTML = customerIntelligence.customers
            .map((customer) => `
                <tr>
                    <td>${customer.customer_id}</td>
                    <td>${money(customer.total_spent)}</td>
                    <td>${number(customer.orders)}</td>
                    <td>${number(customer.units_bought)}</td>
                </tr>
            `)
            .join("");
    }

    
    // Customer Spending Analysis Chart
    const customerChartCanvas = $("customerSpendingChart");

    if (customerChartCanvas) {
        if (window.customerSpendingChart instanceof Chart) {
            window.customerSpendingChart.destroy();
        }

        window.customerSpendingChart = new Chart(
            customerChartCanvas,
            {
                type: "bar",
                data: {
                    labels: customerIntelligence.customers.map(
                        customer => customer.customer_id
                    ),
                    datasets: [{
                        label: "Total Spending (₹)",
                        data: customerIntelligence.customers.map(
                            customer => customer.total_spent
                        ),
                        backgroundColor: "#8b5cf6",
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: value =>
                                    "₹" + value.toLocaleString("en-IN")
                            }
                        }
                    }
                }
            }
        );
    }


        // Product Intelligence KPI cards
        $("piProducts").textContent = number(products.length);

        $("piTopRevenue").textContent = products.length
            ? money(products[0].revenue)
            : money(0);

        $("piTopUnits").textContent = products.length
            ? number(products[0].units_sold)
            : number(0);

        // Product Intelligence revenue chart
        productIntelligenceChart = renderChart(
            productIntelligenceChart,
            "productIntelligenceChart",
            {
                type: "bar",
                data: {
                    labels: products.map(product => product.product),
                    datasets: [{
                        label: "Revenue (₹)",
                        data: products.map(product => product.revenue),
                        backgroundColor: "#8170e8",
                        borderRadius: 6
                    }]
                },
                options: {
                    ...chartOptions(),
                    indexAxis: "y",
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            ticks: {
                                color: "#8e9bb8",
                                callback: value => "₹" + number(value)
                            },
                            grid: { color: "#26314a" }
                        },
                        y: {
                            ticks: { color: "#8e9bb8" },
                            grid: { display: false }
                        }
                    }
                }
            }
        );










// Display growth comparisons beneath each KPI.
const growthElements = {
    revenue: "revenueGrowth",
    orders: "ordersGrowth",
    units: "unitsGrowth",
    customers: "customersGrowth",
    aov: "aovGrowth"
};

Object.entries(growthElements).forEach(([key, elementId]) => {
    const element = $(elementId);

    if (element) {
        element.textContent = growthText(summary.growth?.[
            {
                revenue: "total_revenue",
                orders: "total_orders",
                units: "units_sold",
                customers: "unique_customers",
                aov: "average_order_value"
            }[key]
        ]);

        const value = summary.growth?.[
            {
                revenue: "total_revenue",
                orders: "total_orders",
                units: "units_sold",
                customers: "unique_customers",
                aov: "average_order_value"
            }[key]
        ];

        element.classList.toggle("growth-positive", value > 0);
        element.classList.toggle("growth-negative", value < 0);
    }
});


        trendChart = renderChart(trendChart, "trendChart", {
            type: "line",
            data: {
                labels: trend.labels,
                datasets: [
                    {
                        label: "Revenue (₹)",
                        data: trend.revenue,
                        borderColor: "#a18aff",
                        backgroundColor: "rgba(161,138,255,.15)",
                        fill: true,
                        tension: .35,
                        yAxisID: "y"
                    },
                    {
                        label: "Orders",
                        data: trend.orders,
                        borderColor: "#6c9cff",
                        tension: .35,
                        yAxisID: "y1"
                    }
                ]
            },
            options: {
                ...chartOptions(),
                scales: {
                    ...chartOptions().scales,
                    y: {
                        ...chartOptions().scales.y,
                        ticks: {
                            color: "#8e9bb8",
                            callback: value => "₹" + number(value)
                        }
                    },
                    y1: {
                        position: "right",
                        beginAtZero: true,
                        grid: { drawOnChartArea: false },
                        ticks: { color: "#8e9bb8" }
                    }
                }
            }
        });

        categoryChart = renderChart(categoryChart, "categoryChart", {
            type: "doughnut",
            data: {
                labels: categories.labels,
                datasets: [{
                    data: categories.values,
                    backgroundColor: [
                        "#9b83ff", "#6c9cff", "#55d6be",
                        "#ffb86c", "#ff82ac", "#70c1ff"
                    ],
                    borderColor: "#141c30",
                    borderWidth: 3
                }]
            },
            options: {
                ...chartOptions(),
                cutout: "65%",
                scales: {}
            }
        });

        regionChart = renderChart(regionChart, "regionChart", {
            type: "bar",
            data: {
                labels: regions.labels,
                datasets: [{
                    label: "Revenue",
                    data: regions.values,
                    backgroundColor: "#8170e8",
                    borderRadius: 6
                }]
            },
            options: {
                ...chartOptions(),
                plugins: { legend: { display: false } },
                scales: {
                    ...chartOptions().scales,
                    y: {
                        ...chartOptions().scales.y,
                        ticks: {
                            color: "#8e9bb8",
                            callback: value => "₹" + number(value)
                        }
                    }
                }
            }
        });

        $("productTable").innerHTML = products.length
            ? products.map(p => `
                <tr>
                    <td>${p.product}</td>
                    <td>${number(p.units_sold)}</td>
                    <td>${money(p.revenue)}</td>
                </tr>`).join("")
            : '<tr><td colspan="3">No matching products</td></tr>';

        $("customerTable").innerHTML = customers.length
            ? customers.map(c => `
                <tr>
                    <td>${c.customer_id}</td>
                    <td>${number(c.orders)}</td>
                    <td>${money(c.total_spent)}</td>
                </tr>`).join("")
            : '<tr><td colspan="3">No matching customers</td></tr>';

        $("insightList").innerHTML = insights.insights
            .map(text => `<li>${text}</li>`).join("");

        setStatus(
            `Dashboard updated successfully · ${number(summary.total_orders)} orders in current selection`
        );
    } catch (error) {
        console.error(error);
        setStatus(
            "Unable to load dashboard data. Check that Flask is running and inspect the terminal for errors.",
            true
        );
    }
}

async function initialize() {
    try {
        const filters = await api("/api/filters");

        fillSelect("category", filters.categories);
        fillSelect("region", filters.regions);
        fillSelect("channel", filters.channels);

        $("startDate").min = filters.min_date;
        $("startDate").max = filters.max_date;
        $("endDate").min = filters.min_date;
        $("endDate").max = filters.max_date;

        $("startDate").value = filters.min_date;
        $("endDate").value = filters.max_date;

        await loadDashboard();
    } catch (error) {
        console.error(error);
        setStatus(
            "Could not connect to Flask. Make sure app.py is running.",
            true
        );
    }
}

["category", "region", "channel", "startDate", "endDate"].forEach((id) => {
    $(id).addEventListener("change", () => {
        if (
            $("startDate").value &&
            $("endDate").value &&
            $("startDate").value > $("endDate").value
        ) {
            setStatus("Start date cannot be after end date.", true);
            return;
        }
        loadDashboard();
    });
});

$("resetBtn").addEventListener("click", async () => {
    ["category", "region", "channel"].forEach(id => $(id).value = "All");

    const filters = await api("/api/filters");
    $("startDate").value = filters.min_date;
    $("endDate").value = filters.max_date;

    loadDashboard();
});

$("exportBtn").addEventListener("click", () => {
    window.location.href = filteredUrl("/api/export");
});

initialize();
