// PayTrack Main Frontend Controller
class PayTrackApp {
  constructor() {
    this.employees = [];
    this.paystubs = [];
    this.activePage = "dashboard";
    this.paystubPage = 1;
    this.paystubPerPage = 8;
    
    // Chart instances
    this.dashboardTrendChart = null;
    this.dashboardPieChart = null;
    this.reportsDistChart = null;
    this.reportsDedChart = null;
    
    // Bind methods to ensure correct execution context
    this.init = this.init.bind(this);
  }

  // Application Lifecycle Initializer
  init() {
    console.log("Initializing PayTrack Application...");
    
    // 1. Database initialization (LocalStorage fallback to seed data)
    this.initDatabase();

    // 2. Event Listeners Setup
    this.setupEventListeners();

    // 3. Render initial views
    this.showPage("dashboard");

    // 4. Populate filters dropdown
    this.initFilterSelectors();

    // 5. Toast alert helper check
    this.showToast("PayTrack ready. Add employees and upload paystubs to get started.", "success");
  }

  initDatabase() {
    const localEmployees = localStorage.getItem("paytrack_employees");
    const localPaystubs = localStorage.getItem("paytrack_paystubs");

    // Start with an empty database — no seeding.
    // Only read what is already in localStorage if previously saved by the user.
    if (localEmployees) {
      this.employees = JSON.parse(localEmployees);
    } else {
      this.employees = [];
      localStorage.setItem("paytrack_employees", JSON.stringify([]));
    }

    if (localPaystubs) {
      this.paystubs = JSON.parse(localPaystubs);
    } else {
      this.paystubs = [];
      localStorage.setItem("paytrack_paystubs", JSON.stringify([]));
    }

    // Sort paystubs by payDate descending by default
    this.paystubs.sort((a, b) => new Date(b.payDate) - new Date(a.payDate));
  }

  saveToLocalStorage() {
    localStorage.setItem("paytrack_employees", JSON.stringify(this.employees));
    localStorage.setItem("paytrack_paystubs", JSON.stringify(this.paystubs));
  }

  setupEventListeners() {
    // Page switching via Sidebar Menu
    const navLinks = document.querySelectorAll(".nav-link");
    navLinks.forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const pageId = link.getAttribute("data-page");
        this.showPage(pageId);
      });
    });

    // Handle Employee Modal submissions
    const empForm = document.getElementById("employee-form");
    if (empForm) {
      empForm.addEventListener("submit", (e) => this.saveEmployee(e));
    }

    // Set Default Hired Date in Modal to Today
    document.getElementById("emp-modal-hired").value = new Date().toISOString().split("T")[0];
  }

  // Routing / Page Swapper
  showPage(pageId) {
    console.log(`Navigating to ${pageId} view`);
    this.activePage = pageId;

    // Toggle active sidebar link
    document.querySelectorAll(".nav-link").forEach(link => {
      if (link.getAttribute("data-page") === pageId) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });

    // Toggle visible section
    document.querySelectorAll(".page-section").forEach(sec => {
      if (sec.id === `page-${pageId}`) {
        sec.classList.add("active");
      } else {
        sec.classList.remove("active");
      }
    });

    // Update Header Text dynamically
    const headerTitle = document.getElementById("current-page-title");
    const headerSubtitle = document.getElementById("current-page-subtitle");
    
    switch (pageId) {
      case "dashboard":
        headerTitle.innerText = "Dashboard Overview";
        headerSubtitle.innerText = "Monitor key payroll statutory totals, debt deductions, and trends.";
        this.renderDashboard();
        break;
      case "employees":
        headerTitle.innerText = "Employee Roster";
        headerSubtitle.innerText = "Manage active employee details, hourly wages, and department allocations.";
        this.renderEmployees();
        break;
      case "paystubs":
        headerTitle.innerText = "Paystub Repository";
        headerSubtitle.innerText = "Search, filter, and review details of all employee pay history.";
        this.renderPaystubs();
        break;
      case "upload":
        headerTitle.innerText = "AI Paystub Uploader";
        headerSubtitle.innerText = "Drop payroll documents. AI reads hours, taxes, MISSA, loans, and leaves.";
        this.initUploadView();
        break;
      case "reports":
        headerTitle.innerText = "Payroll Sync Analytics";
        headerSubtitle.innerText = "Deeper statutory visual breakdowns and net pay distributions.";
        this.renderReports();
        break;
    }
  }

  // ==========================================
  // DASHBOARD LOGIC
  // ==========================================
  renderDashboard() {
    this.calculateDashboardKPIs();
    this.renderDashboardRecentTable();
    if (this.paystubs.length > 0) {
      this.renderDashboardCharts();
    } else {
      this.renderDashboardEmptyCharts();
    }
  }

  renderDashboardEmptyCharts() {
    // Destroy any existing charts
    if (this.dashboardTrendChart) { this.dashboardTrendChart.destroy(); this.dashboardTrendChart = null; }
    if (this.dashboardPieChart) { this.dashboardPieChart.destroy(); this.dashboardPieChart = null; }

    const trendCtx = document.getElementById("dashboard-trend-chart").getContext("2d");
    const pieCtx = document.getElementById("dashboard-pie-chart").getContext("2d");

    const emptyOpts = {
      type: "doughnut",
      data: {
        labels: ["No Data Yet"],
        datasets: [{ data: [1], backgroundColor: ["rgba(255,255,255,0.05)"], borderWidth: 0 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        }
      }
    };

    this.dashboardTrendChart = new Chart(trendCtx, {
      type: "line",
      data: { labels: ["–"], datasets: [{ label: "No data yet", data: [0], borderColor: "rgba(99,102,241,0.2)", borderWidth: 2 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "#64748b" } } },
        scales: {
          x: { grid: { color: "rgba(255,255,255,0.03)" }, ticks: { color: "#64748b" } },
          y: { grid: { color: "rgba(255,255,255,0.03)" }, ticks: { color: "#64748b" } }
        }
      }
    });

    this.dashboardPieChart = new Chart(pieCtx, emptyOpts);
  }

  calculateDashboardKPIs() {
    const emptyState = document.getElementById("dashboard-empty-state");
    const kpiGrid = document.querySelector(".kpi-grid");
    const dashboardGrid = document.querySelector(".dashboard-grid");
    const recentCard = document.querySelector("#dashboard-recent-table")?.closest(".glass-card");

    if (this.paystubs.length === 0) {
      if (emptyState) emptyState.style.display = "block";
      if (kpiGrid) kpiGrid.style.display = "none";
      if (dashboardGrid) dashboardGrid.style.display = "none";
      if (recentCard) recentCard.style.display = "none";
      document.getElementById("kpi-net-pay").innerText = "$0.00";
      document.getElementById("kpi-gross-pay").innerText = "$0.00";
      document.getElementById("kpi-hours-worked").innerText = "0.0 hrs";
      document.getElementById("kpi-taxes").innerText = "$0.00";
      document.getElementById("kpi-bomi-loans").innerText = "$0.00";
      document.getElementById("kpi-pension-er").innerText = "$0.00";
      return;
    }

    // Data exists — show KPI grid, hide empty state
    if (emptyState) emptyState.style.display = "none";
    if (kpiGrid) kpiGrid.style.display = "grid";
    if (dashboardGrid) dashboardGrid.style.display = "grid";
    if (recentCard) recentCard.style.display = "block";

    // Bi-weekly periods grouping
    const payDates = [...new Set(this.paystubs.map(stub => stub.payDate))].sort((a,b) => new Date(b) - new Date(a));
    const latestDate = payDates[0];
    const prevDate = payDates[1] || null;

    // Filters paystubs by latest period and previous period for comparisons
    const latestPeriodStubs = this.paystubs.filter(stub => stub.payDate === latestDate);
    const prevPeriodStubs = prevDate ? this.paystubs.filter(stub => stub.payDate === prevDate) : [];

    // LATEST PERIOD CALCULATIONS
    let totalNet = 0;
    let totalGross = 0;
    let totalHours = 0;
    let totalTaxes = 0;
    let totalBomi = 0;
    let totalPensionER = 0;

    latestPeriodStubs.forEach(stub => {
      totalNet += stub.netPay;
      totalGross += stub.grossPay;
      totalHours += (stub.hoursWorked + stub.overtimeHours);
      totalTaxes += stub.taxes.total;
      totalBomi += stub.deductions.bomiLoan;
      totalPensionER += stub.employerContributions.pensionEmployer;
    });

    // Render numbers in cards
    document.getElementById("kpi-net-pay").innerText = this.formatCurrency(totalNet);
    document.getElementById("kpi-gross-pay").innerText = this.formatCurrency(totalGross);
    document.getElementById("kpi-hours-worked").innerText = `${totalHours.toFixed(1)} hrs`;
    document.getElementById("kpi-taxes").innerText = this.formatCurrency(totalTaxes);
    document.getElementById("kpi-bomi-loans").innerText = this.formatCurrency(totalBomi);
    document.getElementById("kpi-pension-er").innerText = this.formatCurrency(totalPensionER);

    // PREVIOUS PERIOD COMPARISON TRENDS
    if (prevPeriodStubs.length > 0) {
      let prevNet = 0;
      let prevGross = 0;

      prevPeriodStubs.forEach(stub => {
        prevNet += stub.netPay;
        prevGross += stub.grossPay;
      });

      const netDiff = ((totalNet - prevNet) / (prevNet || 1)) * 100;
      const grossDiff = ((totalGross - prevGross) / (prevGross || 1)) * 100;

      this.updateTrendIndicator("kpi-net-trend", netDiff);
      this.updateTrendIndicator("kpi-gross-trend", grossDiff);
    } else {
      document.getElementById("kpi-net-trend").innerHTML = `<span class="trend-neutral">New database</span>`;
      document.getElementById("kpi-gross-trend").innerHTML = `<span class="trend-neutral">New database</span>`;
    }
  }

  updateTrendIndicator(elementId, value) {
    const el = document.getElementById(elementId);
    const sign = value >= 0 ? "+" : "";
    const isUp = value >= 0;
    
    el.parentElement.className = `kpi-trend ${isUp ? "trend-up" : "trend-down"}`;
    el.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        ${isUp ? '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>' : '<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12" />'}
      </svg>
      <span>${sign}${value.toFixed(1)}% vs prev period</span>
    `;
  }

  renderDashboardRecentTable() {
    const tbody = document.querySelector("#dashboard-recent-table tbody");
    tbody.innerHTML = "";

    // Show latest 4 paystub entries
    const recents = this.paystubs.slice(0, 4);

    if (recents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);">No paystubs uploaded yet.</td></tr>`;
      return;
    }

    recents.forEach(stub => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <div style="font-weight:600; color:var(--text-primary);">${stub.employeeName}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${stub.employeeId}</div>
        </td>
        <td>${this.formatDateRange(stub.payPeriodStart, stub.payPeriodEnd)}</td>
        <td>${this.formatDate(stub.payDate)}</td>
        <td>${(stub.hoursWorked + stub.overtimeHours).toFixed(1)} hrs</td>
        <td style="font-weight:600;">${this.formatCurrency(stub.grossPay)}</td>
        <td style="color:var(--color-warning);">${this.formatCurrency(stub.deductions.total)}</td>
        <td style="font-weight:700; color:var(--color-success);">${this.formatCurrency(stub.netPay)}</td>
        <td><span class="badge badge-success">${stub.status}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  renderDashboardCharts() {
    // 1. LINE CHART: Spending trends by period
    // Group totals by Pay Date
    const periodTotalsMap = {};
    this.paystubs.forEach(stub => {
      if (!periodTotalsMap[stub.payDate]) {
        periodTotalsMap[stub.payDate] = { gross: 0, net: 0 };
      }
      periodTotalsMap[stub.payDate].gross += stub.grossPay;
      periodTotalsMap[stub.payDate].net += stub.netPay;
    });

    const sortedDates = Object.keys(periodTotalsMap).sort((a,b) => new Date(a) - new Date(b));
    const grossData = sortedDates.map(d => periodTotalsMap[d].gross.toFixed(2));
    const netData = sortedDates.map(d => periodTotalsMap[d].net.toFixed(2));
    const labels = sortedDates.map(d => this.formatDate(d));

    // Destroy existing chart to avoid canvas redraw glitch
    if (this.dashboardTrendChart) this.dashboardTrendChart.destroy();
    
    const trendCtx = document.getElementById("dashboard-trend-chart").getContext("2d");
    this.dashboardTrendChart = new Chart(trendCtx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Gross Spending ($)",
            data: grossData,
            borderColor: "#6366f1",
            backgroundColor: "rgba(99, 102, 241, 0.1)",
            borderWidth: 3,
            tension: 0.35,
            fill: true,
            pointBackgroundColor: "#6366f1"
          },
          {
            label: "Net Employee Payout ($)",
            data: netData,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.05)",
            borderWidth: 3,
            tension: 0.35,
            fill: true,
            pointBackgroundColor: "#10b981"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: "#94a3b8", font: { family: "Outfit" } }
          }
        },
        scales: {
          x: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#94a3b8" } },
          y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#94a3b8" } }
        }
      }
    });

    // 2. PIE CHART: Latest period deductions breakdown
    const latestPayDate = this.paystubs.length > 0 ? this.paystubs[0].payDate : null;
    let latestMissa = 0;
    let latestSSMed = 0;
    let latestFed = 0;
    let latestPension = 0;
    let latestBomi = 0;
    let latestHealth = 0;

    if (latestPayDate) {
      this.paystubs.filter(stub => stub.payDate === latestPayDate).forEach(stub => {
        latestMissa += stub.taxes.missa;
        latestSSMed += (stub.taxes.socialSecurity + stub.taxes.medicare);
        latestFed += stub.taxes.federal;
        latestPension += stub.deductions.pensionEmployee;
        latestBomi += stub.deductions.bomiLoan;
        latestHealth += stub.deductions.healthInsurance;
      });
    }

    if (this.dashboardPieChart) this.dashboardPieChart.destroy();
    
    const pieCtx = document.getElementById("dashboard-pie-chart").getContext("2d");
    this.dashboardPieChart = new Chart(pieCtx, {
      type: "doughnut",
      data: {
        labels: ["MISSA (7%)", "SS & Medicare", "Federal Taxes", "Pension Plan", "BOMI Loan", "Health Ins."],
        datasets: [{
          data: [
            latestMissa.toFixed(2),
            latestSSMed.toFixed(2),
            latestFed.toFixed(2),
            latestPension.toFixed(2),
            latestBomi.toFixed(2),
            latestHealth.toFixed(2)
          ],
          backgroundColor: ["#6366f1", "#0ea5e9", "#ef4444", "#a855f7", "#f59e0b", "#64748b"],
          borderWidth: 2,
          borderColor: "#0f1524"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: { color: "#94a3b8", boxWidth: 12, font: { size: 10 } }
          }
        }
      }
    });
  }

  // ==========================================
  // EMPLOYEE ROSTER SECTION LOGIC
  // ==========================================
  renderEmployees() {
    const tbody = document.querySelector("#employees-table tbody");
    tbody.innerHTML = "";
    
    const searchVal = document.getElementById("employee-search").value.toLowerCase();
    
    const filtered = this.employees.filter(emp => {
      return (
        emp.name.toLowerCase().includes(searchVal) ||
        emp.department.toLowerCase().includes(searchVal) ||
        emp.position.toLowerCase().includes(searchVal) ||
        emp.id.toLowerCase().includes(searchVal)
      );
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);">No employees matching query found.</td></tr>`;
      return;
    }

    filtered.forEach(emp => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-weight:600; color:var(--text-secondary);">${emp.id}</td>
        <td>
          <div style="font-weight:700; color:var(--text-primary); font-size: 0.95rem;">${emp.name}</div>
        </td>
        <td>${emp.department}</td>
        <td>${emp.position}</td>
        <td style="font-weight:600; color:var(--color-success);">${this.formatCurrency(emp.hourlyRate)}/hr</td>
        <td><span class="badge ${emp.status === "Active" ? "badge-success" : "badge-warning"}">${emp.status}</span></td>
        <td>${this.formatDate(emp.dateHired)}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon" onclick="app.editEmployee('${emp.id}')" title="Edit Profile">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button class="btn-icon btn-icon-danger" onclick="app.deleteEmployee('${emp.id}')" title="Delete Profile">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  openEmployeeModal(employeeId = null) {
    const modal = document.getElementById("employee-modal");
    const title = document.getElementById("employee-modal-title");
    const submitBtn = document.getElementById("employee-modal-submit-btn");

    if (employeeId) {
      // EDIT MODE
      const emp = this.employees.find(e => e.id === employeeId);
      if (!emp) return;

      title.innerText = "Edit Employee Profile";
      document.getElementById("emp-modal-id").value = emp.id;
      document.getElementById("emp-modal-name").value = emp.name;
      document.getElementById("emp-modal-dept").value = emp.department;
      document.getElementById("emp-modal-pos").value = emp.position;
      document.getElementById("emp-modal-rate").value = emp.hourlyRate;
      document.getElementById("emp-modal-status").value = emp.status;
      document.getElementById("emp-modal-hired").value = emp.dateHired;
      submitBtn.innerText = "Save Changes";
    } else {
      // CREATE MODE
      title.innerText = "Add New Employee Profile";
      document.getElementById("employee-form").reset();
      document.getElementById("emp-modal-id").value = "";
      document.getElementById("emp-modal-hired").value = new Date().toISOString().split("T")[0];
      submitBtn.innerText = "Save Profile";
    }

    modal.style.display = "flex";
  }

  closeEmployeeModal() {
    document.getElementById("employee-modal").style.display = "none";
  }

  saveEmployee(e) {
    e.preventDefault();
    
    const id = document.getElementById("emp-modal-id").value;
    const name = document.getElementById("emp-modal-name").value.trim();
    const department = document.getElementById("emp-modal-dept").value;
    const position = document.getElementById("emp-modal-pos").value.trim();
    const hourlyRate = parseFloat(document.getElementById("emp-modal-rate").value);
    const status = document.getElementById("emp-modal-status").value;
    const dateHired = document.getElementById("emp-modal-hired").value;

    if (!name || !position || isNaN(hourlyRate)) {
      this.showToast("All fields are required and must be valid", "error");
      return;
    }

    if (id) {
      // Update employee
      const index = this.employees.findIndex(emp => emp.id === id);
      if (index !== -1) {
        this.employees[index] = { ...this.employees[index], name, department, position, hourlyRate, status, dateHired };
        this.showToast(`Updated profile for ${name}`, "success");
      }
    } else {
      // Create new employee with guaranteed unique ID
      const newId = `emp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      this.employees.push({ id: newId, name, department, position, hourlyRate, status, dateHired });
      this.showToast(`Successfully added ${name} to roster`, "success");
    }

    this.saveToLocalStorage();
    this.closeEmployeeModal();
    this.renderEmployees();
    this.initFilterSelectors(); // Update select options
  }

  deleteEmployee(employeeId) {
    const emp = this.employees.find(e => e.id === employeeId);
    if (!emp) return;

    if (confirm(`Are you sure you want to delete ${emp.name}? All linked historical paystubs will remain intact.`)) {
      this.employees = this.employees.filter(e => e.id !== employeeId);
      this.saveToLocalStorage();
      this.showToast(`Employee ${emp.name} deleted successfully`, "success");
      this.renderEmployees();
      this.initFilterSelectors();
    }
  }

  // ==========================================
  // PAYSTUBS VIEW LOGIC
  // ==========================================
  initFilterSelectors() {
    const empSelect = document.getElementById("paystub-filter-employee");
    const reviewEmpSelect = document.getElementById("review-employee");
    const periodSelect = document.getElementById("paystub-filter-period");

    // 1. Populate employees options
    empSelect.innerHTML = `<option value="all">All Employees</option>`;
    reviewEmpSelect.innerHTML = `<option value="" disabled selected>Select active employee...</option>`;

    this.employees.forEach(emp => {
      empSelect.innerHTML += `<option value="${emp.id}">${emp.name}</option>`;
      reviewEmpSelect.innerHTML += `<option value="${emp.id}">${emp.name} (${emp.position})</option>`;
    });

    // 2. Populate pay periods (grouped payDates)
    periodSelect.innerHTML = `<option value="all">All Pay Dates</option>`;
    const payDates = [...new Set(this.paystubs.map(stub => stub.payDate))].sort((a,b) => new Date(b) - new Date(a));
    
    payDates.forEach(date => {
      periodSelect.innerHTML += `<option value="${date}">${this.formatDate(date)}</option>`;
    });
  }

  resetPaystubFilters() {
    document.getElementById("paystub-search").value = "";
    document.getElementById("paystub-filter-employee").value = "all";
    document.getElementById("paystub-filter-period").value = "all";
    this.paystubPage = 1;
    this.renderPaystubs();
  }

  renderPaystubs() {
    const tbody = document.querySelector("#paystubs-table tbody");
    tbody.innerHTML = "";

    const searchVal = document.getElementById("paystub-search").value.toLowerCase();
    const filterEmployee = document.getElementById("paystub-filter-employee").value;
    const filterPeriod = document.getElementById("paystub-filter-period").value;

    const filtered = this.paystubs.filter(stub => {
      const matchSearch = stub.employeeName.toLowerCase().includes(searchVal) || stub.id.toLowerCase().includes(searchVal);
      const matchEmployee = filterEmployee === "all" || stub.employeeId === filterEmployee;
      const matchPeriod = filterPeriod === "all" || stub.payDate === filterPeriod;

      return matchSearch && matchEmployee && matchPeriod;
    });

    // Paginate results
    const totalCount = filtered.length;
    const maxPage = Math.ceil(totalCount / this.paystubPerPage) || 1;
    if (this.paystubPage > maxPage) this.paystubPage = maxPage;

    const startIdx = (this.paystubPage - 1) * this.paystubPerPage;
    const endIdx = startIdx + this.paystubPerPage;
    const paginated = filtered.slice(startIdx, endIdx);

    // Update pagination labels
    document.getElementById("paystub-pagination-info").innerText = 
      totalCount === 0 ? "Showing 0 records" : `Showing ${startIdx + 1}-${Math.min(endIdx, totalCount)} of ${totalCount} records`;
    
    document.getElementById("paystub-prev-btn").disabled = this.paystubPage === 1;
    document.getElementById("paystub-next-btn").disabled = this.paystubPage === maxPage;

    if (paginated.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text-muted);">No paystub records found matching these criteria.</td></tr>`;
      return;
    }

    paginated.forEach(stub => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <div style="font-weight:600; color:var(--text-primary);">${stub.employeeName}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${stub.employeeId}</div>
        </td>
        <td>${this.formatDateRange(stub.payPeriodStart, stub.payPeriodEnd)}</td>
        <td>${this.formatDate(stub.payDate)}</td>
        <td>${stub.hoursWorked.toFixed(1)}</td>
        <td>${stub.overtimeHours.toFixed(1)}</td>
        <td style="font-weight:600;">${this.formatCurrency(stub.grossPay)}</td>
        <td style="color:var(--color-primary);">${this.formatCurrency(stub.taxes.missa)}</td>
        <td style="color:var(--color-warning);">${this.formatCurrency(stub.deductions.total)}</td>
        <td style="font-weight:700; color:var(--color-success);">${this.formatCurrency(stub.netPay)}</td>
        <td>
          <div style="display:flex; gap:0.4rem; align-items:center;">
            <button class="btn btn-secondary" style="padding:0.4rem 0.75rem; font-size:0.8rem;" onclick="app.viewPaystubDetails('${stub.id}')">
              View Slip
            </button>
            <button class="btn-icon btn-icon-danger" onclick="app.deletePaystub('${stub.id}')" title="Delete Record">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  prevPaystubPage() {
    if (this.paystubPage > 1) {
      this.paystubPage--;
      this.renderPaystubs();
    }
  }

  nextPaystubPage() {
    this.paystubPage++;
    this.renderPaystubs();
  }

  viewPaystubDetails(stubId) {
    const stub = this.paystubs.find(s => s.id === stubId);
    if (!stub) return;

    const overlay = document.getElementById("paystub-modal");
    const container = document.getElementById("printable-paystub-content");

    // Precalculate statutory percentages for presentation
    const missaEERate = 7.00;
    const pensionEERate = 5.00;
    const missaERRate = 7.00;
    const pensionERRate = 5.00;

    container.innerHTML = `
      <div class="sheet-header">
        <div class="sheet-company-info">
          <h2>PayTrack Logistics Corp</h2>
          <p>Delap Road, Majuro, Marshall Islands</p>
          <p>Tel: +692 625-3122 | payroll@paytrack.net</p>
        </div>
        <div class="sheet-stub-title">
          <h3>EARNINGS STATEMENT</h3>
          <p>Statement ID: <strong>${stub.id}</strong></p>
          <p>Payment Mode: Direct Deposit</p>
        </div>
      </div>

      <div class="sheet-meta-grid">
        <div class="meta-col">
          <h4>Employee Name</h4>
          <p>${stub.employeeName}</p>
        </div>
        <div class="meta-col">
          <h4>Employee ID</h4>
          <p>${stub.employeeId}</p>
        </div>
        <div class="meta-col">
          <h4>Pay Period</h4>
          <p>${this.formatDateRange(stub.payPeriodStart, stub.payPeriodEnd)}</p>
        </div>
        <div class="meta-col">
          <h4>Payment Date</h4>
          <p>${this.formatDate(stub.payDate)}</p>
        </div>
      </div>

      <table class="sheet-calc-table">
        <thead>
          <tr>
            <th>Earnings Line</th>
            <th class="text-right">Rate</th>
            <th class="text-right">Hours</th>
            <th class="text-right">Current Payout</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Regular Hours Earnings</td>
            <td class="text-right">${this.formatCurrency(stub.hourlyRate)}</td>
            <td class="text-right">${stub.hoursWorked.toFixed(1)}</td>
            <td class="text-right">${this.formatCurrency(stub.regularEarnings)}</td>
          </tr>
          ${stub.overtimeHours > 0 ? `
          <tr>
            <td>Overtime Earnings (1.5x)</td>
            <td class="text-right">${this.formatCurrency(stub.hourlyRate * 1.5)}</td>
            <td class="text-right">${stub.overtimeHours.toFixed(1)}</td>
            <td class="text-right">${this.formatCurrency(stub.overtimeEarnings)}</td>
          </tr>` : ""}
          <tr class="sheet-total-row">
            <td colspan="3">Gross Payroll Earnings</td>
            <td class="text-right">${this.formatCurrency(stub.grossPay)}</td>
          </tr>
        </tbody>
      </table>

      <div class="sheet-sections-2col">
        <!-- Statutory Taxes Column -->
        <div>
          <div class="sheet-section-title">Statutory Tax Withholdings</div>
          <table class="sheet-calc-table">
            <tbody>
              <tr>
                <td>MISSA Employee Tax (${missaEERate.toFixed(2)}%)</td>
                <td class="text-right" style="color:var(--color-danger);">${this.formatCurrency(stub.taxes.missa)}</td>
              </tr>
              <tr>
                <td>Social Security Withholding (6.2%)</td>
                <td class="text-right" style="color:var(--color-danger);">${this.formatCurrency(stub.taxes.socialSecurity)}</td>
              </tr>
              <tr>
                <td>Medicare Statutory Tax (1.45%)</td>
                <td class="text-right" style="color:var(--color-danger);">${this.formatCurrency(stub.taxes.medicare)}</td>
              </tr>
              <tr>
                <td>Federal Income Taxes Withheld (10%)</td>
                <td class="text-right" style="color:var(--color-danger);">${this.formatCurrency(stub.taxes.federal)}</td>
              </tr>
              <tr class="sheet-total-row">
                <td>Total Withheld Taxes</td>
                <td class="text-right" style="color:var(--color-danger);">${this.formatCurrency(stub.taxes.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Deductions Column -->
        <div>
          <div class="sheet-section-title">Voluntary & Debt Deductions</div>
          <table class="sheet-calc-table">
            <tbody>
              <tr>
                <td>Pension Supplemental EE Contribution (${pensionEERate.toFixed(2)}%)</td>
                <td class="text-right" style="color:var(--color-warning);">${this.formatCurrency(stub.deductions.pensionEmployee)}</td>
              </tr>
              <tr>
                <td>BOMI Loan Deduction (Amortized Schedule)</td>
                <td class="text-right" style="color:var(--color-warning);">${this.formatCurrency(stub.deductions.bomiLoan)}</td>
              </tr>
              <tr>
                <td>Group Health Insurance Premium</td>
                <td class="text-right" style="color:var(--color-warning);">${this.formatCurrency(stub.deductions.healthInsurance)}</td>
              </tr>
              <tr class="sheet-total-row">
                <td>Total Other Deductions</td>
                <td class="text-right" style="color:var(--color-warning);">${this.formatCurrency(stub.deductions.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Capital Invested (Employer Match) -->
      <div class="sheet-section-title">Capital Invested / Statutory Employer Contributions</div>
      <table class="sheet-calc-table" style="margin-bottom:1.5rem;">
        <tbody>
          <tr>
            <td>MISSA Employer Pension Match (7.00%)</td>
            <td class="text-right" style="color:var(--color-primary);">${this.formatCurrency(stub.employerContributions.missa)}</td>
          </tr>
          <tr>
            <td>Private Pension Employer Contribution (5.00%)</td>
            <td class="text-right" style="color:var(--color-primary);">${this.formatCurrency(stub.employerContributions.pensionEmployer)}</td>
          </tr>
          <tr class="sheet-total-row" style="background-color:rgba(99,102,241,0.04);">
            <td>Total Employer Match Capital</td>
            <td class="text-right" style="color:var(--color-primary); font-weight:700;">${this.formatCurrency(stub.employerContributions.total)}</td>
          </tr>
        </tbody>
      </table>

      <!-- Net Payout Banner -->
      <div class="net-pay-banner">
        <div class="net-pay-banner-title">
          <h4>Net Employee Payout</h4>
          <p>Total take-home salary after statutory and local schedules</p>
        </div>
        <div class="net-pay-amount">${this.formatCurrency(stub.netPay)}</div>
      </div>

      <!-- Leave Balances -->
      <div class="leave-accrual-row">
        <div>
          <div class="leave-col-title">Sick Leave Balance (Hours)</div>
          <div class="leave-stats">
            <div class="leave-stat-box">
              <h5>Prior Bal.</h5>
              <p>${stub.leave.sickPrev.toFixed(1)}</p>
            </div>
            <div class="leave-stat-box">
              <h5>Accrued</h5>
              <p style="color:var(--color-success);">+${stub.leave.sickAccrued.toFixed(1)}</p>
            </div>
            <div class="leave-stat-box">
              <h5>Used</h5>
              <p style="color:var(--color-danger);">${stub.leave.sickUsed > 0 ? `-${stub.leave.sickUsed.toFixed(1)}` : "0.0"}</p>
            </div>
            <div class="leave-stat-box" style="border-left: 1px solid #cbd5e1; grid-column: span 3; margin-top: 0.35rem; padding-top: 0.25rem;">
              <h5><strong>Current Sick Balance</strong></h5>
              <p style="font-size:0.95rem; color:#0f172a;">${stub.leave.sickBalance.toFixed(1)} hrs</p>
            </div>
          </div>
        </div>

        <div>
          <div class="leave-col-title">Annual Leave Balance (Hours)</div>
          <div class="leave-stats">
            <div class="leave-stat-box">
              <h5>Prior Bal.</h5>
              <p>${stub.leave.annualPrev.toFixed(1)}</p>
            </div>
            <div class="leave-stat-box">
              <h5>Accrued</h5>
              <p style="color:var(--color-success);">+${stub.leave.annualAccrued.toFixed(1)}</p>
            </div>
            <div class="leave-stat-box">
              <h5>Used</h5>
              <p style="color:var(--color-danger);">${stub.leave.annualUsed > 0 ? `-${stub.leave.annualUsed.toFixed(1)}` : "0.0"}</p>
            </div>
            <div class="leave-stat-box" style="border-left: 1px solid #cbd5e1; grid-column: span 3; margin-top: 0.35rem; padding-top: 0.25rem;">
              <h5><strong>Current Annual Balance</strong></h5>
              <p style="font-size:0.95rem; color:#0f172a;">${stub.leave.annualBalance.toFixed(1)} hrs</p>
            </div>
          </div>
        </div>
      </div>

      <div class="sheet-footer">
        <p>This is a computer-generated official payroll slip generated via PayTrack.</p>
        <p>For discrepancies, contact Finance immediately.</p>
      </div>
    `;

    overlay.style.display = "flex";
  }

  closePaystubModal() {
    document.getElementById("paystub-modal").style.display = "none";
  }

  // ==========================================
  // UPLOAD & OCR SIMULATOR LOGIC
  // ==========================================
  initUploadView() {
    this.cancelOCRReview(); // Reset form state

    // Dynamically build demo pills from actual employee roster
    const pillContainer = document.getElementById("dynamic-demo-pills");
    if (pillContainer) {
      if (this.employees.length === 0) {
        pillContainer.innerHTML = `<p style="color:var(--text-muted); font-size:0.8rem; text-align:center;">Add employees first, then use the demo simulation here.</p>`;
      } else {
        pillContainer.innerHTML = this.employees.map(emp =>
          `<div class="sample-pill" onclick="app.simulateDemoUpload('${emp.id}')">${emp.name}</div>`
        ).join("");
      }
    }
  }

  triggerFileSelect() {
    document.getElementById("file-input").click();
  }

  handleDragOver(e) {
    e.preventDefault();
    document.getElementById("dropzone").classList.add("dragover");
  }

  handleDragLeave(e) {
    e.preventDefault();
    document.getElementById("dropzone").classList.remove("dragover");
  }

  handleDrop(e) {
    e.preventDefault();
    document.getElementById("dropzone").classList.remove("dragover");
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      this.processUploadedFile(files[0]);
    }
  }

  handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
      this.processUploadedFile(files[0]);
    }
  }

  processUploadedFile(file) {
    if (this.employees.length === 0) {
      this.showToast("Add at least one employee before uploading a paystub.", "error");
      return;
    }

    console.log(`Processing file: ${file.name}`);
    const scanOverlay = document.getElementById("scan-overlay");
    const scanStatus = document.getElementById("scan-status");
    
    scanOverlay.style.display = "flex";

    // Simulate AI LLM processing stages
    setTimeout(() => {
      scanStatus.innerText = "Extracting text contours via OCR...";
      setTimeout(() => {
        scanStatus.innerText = "Matching employee records and parsing wages...";
        setTimeout(() => {
          scanStatus.innerText = "Applying local tax models (MISSA & BOMI loans)...";
          setTimeout(() => {
            scanOverlay.style.display = "none";
            
            // Pick first employee if roster has entries
            const firstEmp = this.employees[0];
            this.prefillOCRReviewForm(firstEmp.id);
            this.showToast(`AI successfully parsed "${file.name}" — review the extracted data.`, "success");
          }, 600);
        }, 600);
      }, 600);
    }, 600);
  }

  simulateDemoUpload(employeeId) {
    const scanOverlay = document.getElementById("scan-overlay");
    const scanStatus = document.getElementById("scan-status");
    
    scanOverlay.style.display = "flex";
    scanStatus.innerText = "Connecting to OCR Engine...";

    setTimeout(() => {
      scanStatus.innerText = "Reading structural lines & leave balances...";
      setTimeout(() => {
        scanStatus.innerText = "Reconciling statutory deductions...";
        setTimeout(() => {
          scanOverlay.style.display = "none";
          this.prefillOCRReviewForm(employeeId);
          this.showToast("Demo OCR parsed successfully!", "success");
        }, 500);
      }, 500);
    }, 500);
  }

  prefillOCRReviewForm(employeeId) {
    const emp = this.employees.find(e => e.id === employeeId);
    if (!emp) return;

    const formCard = document.getElementById("review-form-card");
    formCard.classList.add("active");

    // Populate employee and rate
    document.getElementById("review-employee").value = emp.id;
    document.getElementById("review-hourly-rate").value = emp.hourlyRate.toFixed(2);
    
    // Assign bi-weekly dates based on today
    const today = new Date();
    const payPeriodEndStr = today.toISOString().split("T")[0];
    
    const payPeriodStart = new Date();
    payPeriodStart.setDate(today.getDate() - 14);
    const payPeriodStartStr = payPeriodStart.toISOString().split("T")[0];
    
    const payDate = new Date();
    payDate.setDate(today.getDate() + 5);
    const payDateStr = payDate.toISOString().split("T")[0];

    document.getElementById("review-period-start").value = payPeriodStartStr;
    document.getElementById("review-period-end").value = payPeriodEndStr;
    document.getElementById("review-pay-date").value = payDateStr;

    // Standard bi-weekly hours — user can adjust
    document.getElementById("review-hours-worked").value = 80;
    document.getElementById("review-ot-hours").value = 0;

    // Default deductions — user adjusts per actual paystub
    document.getElementById("review-bomi-loan").value = "0.00";
    document.getElementById("review-health").value = "75.00";

    this.recalculateReviewTotals();
  }

  updateReviewFormRates() {
    const empId = document.getElementById("review-employee").value;
    const emp = this.employees.find(e => e.id === empId);
    if (emp) {
      document.getElementById("review-hourly-rate").value = emp.hourlyRate.toFixed(2);
      this.recalculateReviewTotals();
    }
  }

  recalculateReviewTotals() {
    const hourlyRate = parseFloat(document.getElementById("review-hourly-rate").value) || 0;
    const regHours = parseFloat(document.getElementById("review-hours-worked").value) || 0;
    const otHours = parseFloat(document.getElementById("review-ot-hours").value) || 0;
    const bomiLoan = parseFloat(document.getElementById("review-bomi-loan").value) || 0;
    const healthIns = parseFloat(document.getElementById("review-health").value) || 0;

    const regularEarnings = regHours * hourlyRate;
    const overtimeEarnings = otHours * (hourlyRate * 1.5);
    const grossPay = regularEarnings + overtimeEarnings;

    // Taxes
    const missaEmployeeTax = Number((grossPay * 0.07).toFixed(2)); // MISSA 7%
    const socialSecurity = Number((grossPay * 0.062).toFixed(2)); // SS 6.2%
    const medicare = Number((grossPay * 0.0145).toFixed(2)); // Medicare 1.45%
    const federalTax = Number((grossPay * 0.10).toFixed(2)); // Mock Fed Tax 10%
    const totalTaxes = Number((missaEmployeeTax + socialSecurity + medicare + federalTax).toFixed(2));

    // Deductions
    const pensionEmployeeShare = Number((grossPay * 0.05).toFixed(2)); // Pension supplemental 5%
    const totalDeductions = Number((pensionEmployeeShare + bomiLoan + healthIns).toFixed(2));

    // Net
    const netPay = Number((grossPay - totalTaxes - totalDeductions).toFixed(2));

    // Update form badges
    document.getElementById("review-sum-gross").innerText = this.formatCurrency(grossPay);
    document.getElementById("review-sum-taxes").innerText = this.formatCurrency(totalTaxes);
    document.getElementById("review-sum-deductions").innerText = this.formatCurrency(totalDeductions);
    document.getElementById("review-sum-net").innerText = this.formatCurrency(netPay);
  }

  saveExtractedPaystub(e) {
    e.preventDefault();

    const empId = document.getElementById("review-employee").value;
    const emp = this.employees.find(el => el.id === empId);
    if (!emp) return;

    const payPeriodStart = document.getElementById("review-period-start").value;
    const payPeriodEnd = document.getElementById("review-period-end").value;
    const payDate = document.getElementById("review-pay-date").value;
    const hourlyRate = parseFloat(document.getElementById("review-hourly-rate").value);
    const hoursWorked = parseFloat(document.getElementById("review-hours-worked").value);
    const overtimeHours = parseFloat(document.getElementById("review-ot-hours").value);
    const bomiLoanDeduction = parseFloat(document.getElementById("review-bomi-loan").value);
    const healthInsurance = parseFloat(document.getElementById("review-health").value);

    // Dynamic payroll formulas mapping
    const regularEarnings = hoursWorked * hourlyRate;
    const overtimeEarnings = overtimeHours * (hourlyRate * 1.5);
    const grossPay = regularEarnings + overtimeEarnings;

    const missaEmployeeTax = Number((grossPay * 0.07).toFixed(2));
    const socialSecurity = Number((grossPay * 0.062).toFixed(2));
    const medicare = Number((grossPay * 0.0145).toFixed(2));
    const federalTax = Number((grossPay * 0.10).toFixed(2));
    const totalTaxes = Number((missaEmployeeTax + socialSecurity + medicare + federalTax).toFixed(2));

    const pensionEmployeeShare = Number((grossPay * 0.05).toFixed(2));
    const totalDeductions = Number((pensionEmployeeShare + bomiLoanDeduction + healthInsurance).toFixed(2));
    const netPay = Number((grossPay - totalTaxes - totalDeductions).toFixed(2));

    const missaEmployerTax = Number((grossPay * 0.07).toFixed(2));
    const pensionEmployerShare = Number((grossPay * 0.05).toFixed(2));
    const totalEmployerContributions = Number((missaEmployerTax + pensionEmployerShare).toFixed(2));

    // Get previous leave balance from newest existing stub or default
    const prevStubs = this.paystubs.filter(s => s.employeeId === empId);
    let prevSickBalance = 24.0;
    let prevAnnualBalance = 40.0;
    if (prevStubs.length > 0) {
      prevSickBalance = prevStubs[0].leave.sickBalance;
      prevAnnualBalance = prevStubs[0].leave.annualBalance;
    }

    const sickAccrued = 4.0;
    const annualAccrued = 6.0;
    const sickUsed = overtimeHours > 4 ? 0 : 0; // Simple simulation
    const annualUsed = 0;

    const newStub = {
      id: `stub-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      employeeId: empId,
      employeeName: emp.name,
      payPeriodStart,
      payPeriodEnd,
      payDate,
      hoursWorked,
      overtimeHours,
      hourlyRate,
      regularEarnings,
      overtimeEarnings,
      grossPay,
      taxes: {
        missa: missaEmployeeTax,
        socialSecurity,
        medicare,
        federal: federalTax,
        total: totalTaxes
      },
      deductions: {
        pensionEmployee: pensionEmployeeShare,
        bomiLoan: bomiLoanDeduction,
        healthInsurance,
        total: totalDeductions
      },
      netPay,
      employerContributions: {
        missa: missaEmployerTax,
        pensionEmployer: pensionEmployerShare,
        total: totalEmployerContributions
      },
      leave: {
        sickPrev: prevSickBalance,
        sickAccrued,
        sickUsed,
        sickBalance: prevSickBalance + sickAccrued - sickUsed,
        annualPrev: prevAnnualBalance,
        annualAccrued,
        annualUsed,
        annualBalance: prevAnnualBalance + annualAccrued - annualUsed
      },
      status: "Approved",
      fileName: `paystub_${emp.name.toLowerCase().replace(" ", "_")}_${payDate}.pdf`
    };

    // Save Stub & Refresh State
    this.paystubs.unshift(newStub);
    this.saveToLocalStorage();
    
    this.showToast(`Paystub successfully committed for ${emp.name}`, "success");
    
    // Refresh filter options
    this.initFilterSelectors();
    
    // Route to paystubs
    this.showPage("paystubs");
  }

  cancelOCRReview() {
    const formCard = document.getElementById("review-form-card");
    formCard.classList.remove("active");
    document.getElementById("paystub-ocr-form").reset();
    
    document.getElementById("review-sum-gross").innerText = "$0.00";
    document.getElementById("review-sum-taxes").innerText = "$0.00";
    document.getElementById("review-sum-deductions").innerText = "$0.00";
    document.getElementById("review-sum-net").innerText = "$0.00";
  }

  // ==========================================
  // REPORTS VIEW LOGIC
  // ==========================================
  renderReports() {
    let cumulativeMissaEE = 0;
    let cumulativeMissaER = 0;
    let cumulativeBomi = 0;
    let cumulativePensionEE = 0;
    let cumulativePensionER = 0;
    let cumulativeFedSSMed = 0;

    this.paystubs.forEach(stub => {
      cumulativeMissaEE += stub.taxes.missa;
      cumulativeMissaER += stub.employerContributions.missa;
      cumulativeBomi += stub.deductions.bomiLoan;
      cumulativePensionEE += stub.deductions.pensionEmployee;
      cumulativePensionER += stub.employerContributions.pensionEmployer;
      cumulativeFedSSMed += (stub.taxes.socialSecurity + stub.taxes.medicare + stub.taxes.federal);
    });

    // Populate statutory totals in table
    document.getElementById("rep-tot-missa-ee").innerText = this.formatCurrency(cumulativeMissaEE);
    document.getElementById("rep-tot-missa-er").innerText = this.formatCurrency(cumulativeMissaER);
    document.getElementById("rep-tot-bomi").innerText = this.formatCurrency(cumulativeBomi);
    document.getElementById("rep-tot-pension-ee").innerText = this.formatCurrency(cumulativePensionEE);
    document.getElementById("rep-tot-pension-er").innerText = this.formatCurrency(cumulativePensionER);
    document.getElementById("rep-tot-fed-ss").innerText = this.formatCurrency(cumulativeFedSSMed);

    // Calculate Net Pay distribution by employee (All-time sum)
    const empSums = {};
    this.paystubs.forEach(stub => {
      if (!empSums[stub.employeeName]) {
        empSums[stub.employeeName] = 0;
      }
      empSums[stub.employeeName] += stub.netPay;
    });

    const empLabels = Object.keys(empSums);
    const empNetValues = Object.values(empSums).map(val => val.toFixed(2));

    // Render bar chart
    if (this.reportsDistChart) this.reportsDistChart.destroy();
    
    const distCtx = document.getElementById("reports-net-distribution-chart").getContext("2d");
    this.reportsDistChart = new Chart(distCtx, {
      type: "bar",
      data: {
        labels: empLabels,
        datasets: [{
          label: "Cumulative Net Take-Home Pay ($)",
          data: empNetValues,
          backgroundColor: "rgba(16, 185, 129, 0.4)",
          borderColor: "#10b981",
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: "#94a3b8", font: { family: "Outfit" } } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#94a3b8" } },
          y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#94a3b8" } }
        }
      }
    });

    // Deduction Breakdown doughnut chart for latest period
    const latestPayDate = this.paystubs.length > 0 ? this.paystubs[0].payDate : null;
    let latestMissa = 0;
    let latestPension = 0;
    let latestBomi = 0;
    let latestHealth = 0;

    if (latestPayDate) {
      this.paystubs.filter(stub => stub.payDate === latestPayDate).forEach(stub => {
        latestMissa += stub.taxes.missa;
        latestPension += stub.deductions.pensionEmployee;
        latestBomi += stub.deductions.bomiLoan;
        latestHealth += stub.deductions.healthInsurance;
      });
    }

    if (this.reportsDedChart) this.reportsDedChart.destroy();
    
    const dedCtx = document.getElementById("reports-deduction-chart").getContext("2d");
    this.reportsDedChart = new Chart(dedCtx, {
      type: "doughnut",
      data: {
        labels: ["MISSA (7%)", "Pension EE (5%)", "BOMI Loans", "Group Health"],
        datasets: [{
          data: [latestMissa.toFixed(2), latestPension.toFixed(2), latestBomi.toFixed(2), latestHealth.toFixed(2)],
          backgroundColor: ["#6366f1", "#a855f7", "#f59e0b", "#94a3b8"],
          borderWidth: 2,
          borderColor: "#0f1524"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right", labels: { color: "#94a3b8", font: { family: "Outfit" } } }
        }
      }
    });

    // Build sidebar text list in reports
    const listItems = document.getElementById("reports-summary-list");
    listItems.innerHTML = `
      <div class="report-item">
        <div class="report-item-info">
          <div class="report-item-circle" style="background-color:#6366f1;"></div>
          <span class="report-item-name">MISSA Deductions</span>
        </div>
        <span class="report-item-val">${this.formatCurrency(latestMissa)}</span>
      </div>
      <div class="report-item">
        <div class="report-item-info">
          <div class="report-item-circle" style="background-color:#a855f7;"></div>
          <span class="report-item-name">Pension Contributions</span>
        </div>
        <span class="report-item-val">${this.formatCurrency(latestPension)}</span>
      </div>
      <div class="report-item">
        <div class="report-item-info">
          <div class="report-item-circle" style="background-color:#f59e0b;"></div>
          <span class="report-item-name">BOMI Loan Deductions</span>
        </div>
        <span class="report-item-val">${this.formatCurrency(latestBomi)}</span>
      </div>
    `;
  }

  // ==========================================
  // UTILITIES & HELPER METHODS
  // ==========================================
  formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(value);
  }

  formatDate(dateStr) {
    // Parse as local date to avoid UTC offset shifting the day
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const options = { year: "numeric", month: "short", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
  }

  formatDateRange(startStr, endStr) {
    const [sy, sm, sd] = startStr.split("-").map(Number);
    const [ey, em, ed] = endStr.split("-").map(Number);
    const start = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);
    const options = { month: "short", day: "numeric" };
    return `${start.toLocaleDateString("en-US", options)} — ${end.toLocaleDateString("en-US", options)}, ${end.getFullYear()}`;
  }

  showToast(message, type = "success") {
    const toast = document.getElementById("toast-notification");
    const icon = document.getElementById("toast-icon");
    const msg = document.getElementById("toast-message");

    toast.className = `toast toast-${type} show`;
    msg.innerText = message;

    if (type === "success") {
      icon.innerHTML = `<svg width="18" height="18" fill="var(--color-success)" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`;
    } else {
      icon.innerHTML = `<svg width="18" height="18" fill="var(--color-danger)" viewBox="0 0 24 24"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
    }

    setTimeout(() => {
      toast.classList.remove("show");
    }, 4000);
  }

  // Alias so HTML onclick="app.editEmployee(id)" works
  editEmployee(id) {
    this.openEmployeeModal(id);
  }

  // Delete a paystub record from the database
  deletePaystub(stubId) {
    const stub = this.paystubs.find(s => s.id === stubId);
    if (!stub) return;
    if (confirm(`Delete paystub for ${stub.employeeName} (${this.formatDate(stub.payDate)})?\nThis action cannot be undone.`)) {
      this.paystubs = this.paystubs.filter(s => s.id !== stubId);
      this.saveToLocalStorage();
      this.initFilterSelectors();
      this.showToast(`Paystub record deleted.`, "success");
      this.renderPaystubs();
    }
  }
}

// Instantiate app and mount onto window object
window.app = new PayTrackApp();
window.addEventListener("DOMContentLoaded", window.app.init);
console.log("PayTrack controller loaded and mounted.");
