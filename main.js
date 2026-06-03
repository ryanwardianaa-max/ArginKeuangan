const supabaseUrl = 'https://wdilryxahcylzosahdof.supabase.co';
const supabaseKey = 'sb_publishable_P7bFTCnPhvyzqpmAxcAmRw_3cJCYbkY';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

const defaultCategories = [
  'Saldo Awal', 'Bagi Hasil', 'Promosi', 'Inventaris', 'Penjualan',
  'Operasional', 'Transportasi', 'Pendapatan Lainnya', 'Hutang / Supplier', 'Lain-Lain'
];
const defaultAccounts = ['Dompet Utama'];

function getCurrentUsername() {
  const user = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
  return user.username || 'admin';
}

async function initUserData() {
  // Check if categories exist (any user_id)
  const { data: cats } = await supabase.from('categories').select('id');
  if (!cats || cats.length === 0) {
    const catPayload = defaultCategories.map(c => ({ user_id: getCurrentUsername(), name: c }));
    await supabase.from('categories').insert(catPayload);
  }
  
  // Check if accounts exist (any user_id)
  const { data: accs } = await supabase.from('accounts').select('id');
  if (!accs || accs.length === 0) {
    await supabase.from('accounts').insert([{ user_id: getCurrentUsername(), name: 'Dompet Utama' }]);
  }
}

async function getTransactions() {
  const { data, error } = await supabase.from('transactions').select('*');
  if (error) { console.error(error); return []; }
  return data;
}

async function getCategoryList() {
  const { data, error } = await supabase.from('categories').select('*');
  if (error) { console.error(error); return []; }
  return data.map(c => c.name);
}

async function getAccountList() {
  const { data, error } = await supabase.from('accounts').select('*');
  if (error) { console.error(error); return []; }
  return data.map(a => a.name);
}

async function getUsersList() {
  const { data, error } = await supabase.from('app_users').select('*').order('username');
  if (error) { console.error(error); return []; }
  return data;
}

window.activeAccount = localStorage.getItem('active_account') || 'Semua Akun';
window.dateFilterType = 'Semua';
window.customStartDate = '';
window.customEndDate = '';

window.handleLogin = async (e) => {
  e.preventDefault();
  const btn = document.querySelector('#loginForm button');
  btn.innerHTML = 'Memuat...';
  btn.disabled = true;

  const u = document.getElementById('loginUsername').value;
  const p = document.getElementById('loginPassword').value;
  
  const { data, error } = await supabase.from('app_users').select('*').eq('username', u).eq('password', p);
  
  if (data && data.length > 0) {
    sessionStorage.setItem('currentUser', JSON.stringify(data[0]));
    await initUserData();
    document.getElementById('loginError').classList.add('hidden');
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    checkAuth();
  } else {
    document.getElementById('loginError').classList.remove('hidden');
  }

  btn.innerHTML = 'Masuk';
  btn.disabled = false;
};

window.handleLogout = () => {
  sessionStorage.removeItem('currentUser');
  checkAuth();
};

window.checkAuth = () => {
  const current = sessionStorage.getItem('currentUser');
  if (current) {
    const user = JSON.parse(current);
    document.getElementById('login-wrapper').classList.add('hidden');
    document.getElementById('login-wrapper').classList.remove('flex');
    document.getElementById('app-wrapper').classList.remove('hidden');
    const mobileNav = document.getElementById('mobile-nav');
    if (mobileNav) { mobileNav.classList.remove('hidden'); }
    document.getElementById('nav-user-name').textContent = user.username;
    
    if (user.role === 'admin') {
      document.getElementById('nav-users-container').classList.remove('hidden');
      const mUsers = document.getElementById('mobile-nav-users');
      if (mUsers) {
        mUsers.classList.remove('hidden');
        mUsers.classList.add('flex');
      }
    } else {
      document.getElementById('nav-users-container').classList.add('hidden');
      const mUsers = document.getElementById('mobile-nav-users');
      if (mUsers) {
        mUsers.classList.add('hidden');
        mUsers.classList.remove('flex');
      }
    }
    if (user.role !== 'admin' && currentView === 'users') currentView = 'dashboard';
    
    navigateTo(currentView);
  } else {
    document.getElementById('login-wrapper').classList.remove('hidden');
    document.getElementById('login-wrapper').classList.add('flex');
    document.getElementById('app-wrapper').classList.add('hidden');
    const mobileNav = document.getElementById('mobile-nav');
    if (mobileNav) { mobileNav.classList.add('hidden'); }
  }
};

function parseDateStr(str) {
  const months = { 'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'Mei': 4, 'May': 4, 'Jun': 5, 'Jul': 6, 'Agt': 7, 'Aug': 7, 'Sep': 8, 'Okt': 9, 'Oct': 9, 'Nov': 10, 'Nop': 10, 'Des': 11, 'Dec': 11 };
  const parts = str.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2], 10), months[parts[1]] || 0, parseInt(parts[0], 10));
  }
  return new Date(str);
}

async function getFilteredTransactions() {
  const raw = await getTransactions();
  
  // 1. Account Filter
  let filtered = raw;
  if (window.activeAccount !== 'Semua Akun') {
    filtered = filtered.filter(tx => tx.akun === window.activeAccount || (!tx.akun && window.activeAccount === 'Dompet Utama'));
  }
  
  // 2. Date Filter
  if (window.dateFilterType !== 'Semua') {
    const now = new Date();
    let start = null, end = null;
    
    if (window.dateFilterType === 'Hari') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (window.dateFilterType === 'Minggu') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); 
      start = new Date(now.getFullYear(), now.getMonth(), diff);
      end = new Date(now.getFullYear(), now.getMonth(), start.getDate() + 6, 23, 59, 59);
    } else if (window.dateFilterType === 'Bulan') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (window.dateFilterType === 'Custom') {
      if (window.customStartDate) {
        start = new Date(window.customStartDate);
        start.setHours(0, 0, 0, 0);
      }
      if (window.customEndDate) {
        end = new Date(window.customEndDate);
        end.setHours(23, 59, 59, 999);
      }
    }
    
    if (start || end) {
      filtered = filtered.filter(tx => {
        const d = parseDateStr(tx.tanggal);
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }
  }

  // 3. Category Filter
  if (window.filterKategori && window.filterKategori !== 'All') {
    filtered = filtered.filter(tx => tx.kategori === window.filterKategori);
  }

  // 4. Type Filter
  if (window.filterJenis && window.filterJenis !== 'All') {
    filtered = filtered.filter(tx => tx.jenis === window.filterJenis);
  }

  // Sort by date (descending)
  return filtered.sort((a, b) => parseDateStr(b.tanggal) - parseDateStr(a.tanggal));
}

async function updateGlobalAccountSelector() {
  const accs = await getAccountList();
  const select = document.getElementById('global-account-selector');
  if (!select) return;
  select.innerHTML = `
    <option value="Semua Akun" ${window.activeAccount === 'Semua Akun' ? 'selected' : ''}>Semua Akun</option>
    ${accs.map(a => `<option value="${a}" ${window.activeAccount === a ? 'selected' : ''}>${a}</option>`).join('')}
    <option value="ADD_NEW">+ Tambah Akun</option>
  `;
}

window.switchGlobalAccount = async (val) => {
  if (val === 'ADD_NEW') {
    const newAcc = prompt("Masukkan nama dompet / akun baru:");
    if (newAcc && newAcc.trim() !== '') {
      const accs = await getAccountList();
      if (!accs.includes(newAcc.trim())) {
        await supabase.from('accounts').insert([{ user_id: getCurrentUsername(), name: newAcc.trim() }]);
        window.activeAccount = newAcc.trim();
      } else {
        alert("Akun tersebut sudah ada.");
        window.activeAccount = 'Semua Akun';
      }
    } else {
      window.activeAccount = 'Semua Akun';
    }
  } else {
    window.activeAccount = val;
  }
  localStorage.setItem('active_account', window.activeAccount);
  await updateGlobalAccountSelector();
  render();
};

const formatCurrency = (num) => {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(num);
};

let currentView = 'dashboard';
const appDiv = document.getElementById('app');

let barChartInstance = null;
let pieChartInstance = null;

document.getElementById('nav-dashboard').addEventListener('click', (e) => { e.preventDefault(); navigateTo('dashboard'); });
document.getElementById('nav-transactions').addEventListener('click', (e) => { e.preventDefault(); navigateTo('transactions'); });
document.getElementById('nav-categories').addEventListener('click', (e) => { e.preventDefault(); navigateTo('categories'); });
document.getElementById('nav-settings').addEventListener('click', (e) => { e.preventDefault(); navigateTo('settings'); });
const navUsersBtn = document.getElementById('nav-users');
if (navUsersBtn) navUsersBtn.addEventListener('click', (e) => { e.preventDefault(); navigateTo('users'); });

document.getElementById('mobile-nav-dashboard').addEventListener('click', (e) => { e.preventDefault(); navigateTo('dashboard'); });
document.getElementById('mobile-nav-transactions').addEventListener('click', (e) => { e.preventDefault(); navigateTo('transactions'); });
document.getElementById('mobile-nav-categories').addEventListener('click', (e) => { e.preventDefault(); navigateTo('categories'); });
document.getElementById('mobile-nav-settings').addEventListener('click', (e) => { e.preventDefault(); navigateTo('settings'); });
const mNavUsersBtn = document.getElementById('mobile-nav-users');
if (mNavUsersBtn) mNavUsersBtn.addEventListener('click', (e) => { e.preventDefault(); navigateTo('users'); });

function updateNavHighlight() {
  ['dashboard', 'transactions', 'categories', 'settings', 'users'].forEach(view => {
    const el = document.getElementById(`nav-${view}`);
    const mel = document.getElementById(`mobile-nav-${view}`);
    const isUsers = view === 'users';
    
    if (el) {
      if (view === currentView) {
        el.className = 'text-primary whitespace-nowrap' + (isUsers ? ' flex items-center gap-1.5' : '');
      } else {
        el.className = 'text-body hover:text-primary transition-colors whitespace-nowrap' + (isUsers ? ' flex items-center gap-1.5' : '');
      }
    }
    
    if (mel) {
      // Keep hidden if it's users and currently hidden by checkAuth
      const isHidden = mel.classList.contains('hidden');
      if (view === currentView) {
        mel.className = (isHidden ? 'hidden ' : 'flex ') + 'flex-col items-center gap-1 p-2 text-primary';
      } else {
        mel.className = (isHidden ? 'hidden ' : 'flex ') + 'flex-col items-center gap-1 p-2 text-body hover:text-primary transition-colors';
      }
    }
  });
}

async function navigateTo(view) {
  currentView = view;
  updateNavHighlight();
  await render();
}

async function render() {
  await updateGlobalAccountSelector();
  
  const dateFilter = document.getElementById('global-date-filter-container');
  if (dateFilter) {
    if (['dashboard', 'transactions'].includes(currentView)) {
      dateFilter.classList.remove('hidden');
      dateFilter.classList.add('flex');
    } else {
      dateFilter.classList.add('hidden');
      dateFilter.classList.remove('flex');
    }
  }

  if (currentView === 'dashboard') {
    await renderDashboard();
  } else if (currentView === 'transactions') {
    await renderTransactions();
  } else if (currentView === 'categories') {
    await renderCategories();
  } else if (currentView === 'settings') {
    await renderSettings();
  } else if (currentView === 'users') {
    await renderUsers();
  }
}

window.filterJenis = window.filterJenis || 'All';
window.filterKategori = window.filterKategori || 'All';

window.setFilterJenis = (jenis) => {
  window.filterJenis = window.filterJenis === jenis ? 'All' : jenis;
  renderDashboard();
};

window.setFilterKategori = (kat) => {
  window.filterKategori = kat;
  renderDashboard();
};

const svgCurveIcon = `<svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path></svg>`;
const svgPieIcon = `<svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"></path></svg>`;

async function renderDashboard() {
  const txs = await getFilteredTransactions();
  let totalIn = 0;
  let totalOut = 0;
  
  const expenseCategories = {};
  const dateMap = {};

  txs.forEach(tx => {
    if (!dateMap[tx.tanggal]) dateMap[tx.tanggal] = { in: 0, out: 0 };

    if (tx.jenis === 'Pemasukan') {
      totalIn += Number(tx.jumlah);
      dateMap[tx.tanggal].in += Number(tx.jumlah);
    } else {
      totalOut += Number(tx.jumlah);
      dateMap[tx.tanggal].out += Number(tx.jumlah);
      if (tx.kategori) {
        expenseCategories[tx.kategori] = (expenseCategories[tx.kategori] || 0) + Number(tx.jumlah);
      }
    }
  });

  // Hitung Saldo Absolut
  let saldo = 0;
  const allTxs = await getTransactions();
  let filteredSaldoTxs = allTxs;
  if (window.activeAccount !== 'Semua Akun') {
    filteredSaldoTxs = filteredSaldoTxs.filter(tx => tx.akun === window.activeAccount || (!tx.akun && window.activeAccount === 'Dompet Utama'));
  }
  
  if (window.dateFilterType !== 'Semua') {
    let endDate = null;
    const now = new Date();
    if (window.dateFilterType === 'Hari') endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    else if (window.dateFilterType === 'Minggu') endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 7, 23, 59, 59);
    else if (window.dateFilterType === 'Bulan') endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    else if (window.dateFilterType === 'Custom' && window.customEndDate) endDate = new Date(window.customEndDate);
    else endDate = now;

    filteredSaldoTxs = filteredSaldoTxs.filter(tx => parseDateStr(tx.tanggal) <= endDate);
  }

  filteredSaldoTxs.forEach(tx => {
    if (tx.jenis === 'Pemasukan') saldo += Number(tx.jumlah);
    else saldo -= Number(tx.jumlah);
  });

    const uniqueCategories = await getCategoryList();

  let filteredTxs = txs;
  if (window.filterJenis !== 'All') {
    filteredTxs = filteredTxs.filter(t => t.jenis === window.filterJenis);
  }
  if (window.filterKategori !== 'All') {
    filteredTxs = filteredTxs.filter(t => t.kategori === window.filterKategori);
  }

appDiv.innerHTML = `
    <div class="space-y-6 md:space-y-8">
      <!-- Header Band -->
      <div class="bg-surface-card-dark rounded-xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6 shadow-sm border border-hairline-on-dark">
        <div>
          <h1 class="text-3xl md:text-4xl font-bold text-on-dark mb-2 tracking-tight">Financial Overview</h1>
          <p class="text-muted text-sm md:text-base">Real-time enterprise cash flow monitor - <span class="font-bold text-primary">${window.activeAccount}</span></p>
        </div>
        <div class="flex flex-wrap gap-3 w-full md:w-auto">
          <button onclick="exportToExcel()" class="flex-1 md:flex-none bg-surface-elevated-dark text-on-dark px-4 md:px-6 py-2.5 md:py-3 rounded-md text-sm md:text-base font-semibold hover:bg-gray-700 transition border border-hairline-on-dark whitespace-nowrap">Export Excel</button>
          <button onclick="exportToPDF()" class="flex-1 md:flex-none bg-primary text-on-primary px-4 md:px-6 py-2.5 md:py-3 rounded-md text-sm md:text-base font-semibold hover:bg-primary-active transition whitespace-nowrap">Export PDF</button>
        </div>
      </div>

      <!-- Metrics -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        <div onclick="setFilterJenis('All')" class="cursor-pointer bg-surface-card-dark rounded-xl p-5 md:p-6 border ${window.filterJenis === 'All' ? 'border-primary ring-1 ring-primary' : 'border-hairline-on-dark'} hover:border-primary transition">
          <h3 class="text-muted text-xs md:text-sm font-semibold mb-2 uppercase tracking-wide">Total Saldo (Semua)</h3>
          <div class="font-tabular text-2xl md:text-3xl font-bold text-primary truncate" title="${formatCurrency(saldo)}">${formatCurrency(saldo)}</div>
        </div>
        <div onclick="setFilterJenis('Pemasukan')" class="cursor-pointer bg-surface-card-dark rounded-xl p-5 md:p-6 border ${window.filterJenis === 'Pemasukan' ? 'border-trading-up ring-1 ring-trading-up' : 'border-hairline-on-dark'} hover:border-trading-up transition">
          <h3 class="text-muted text-xs md:text-sm font-semibold mb-2 uppercase tracking-wide">Total Pemasukan</h3>
          <div class="font-tabular text-2xl md:text-3xl font-bold text-trading-up truncate" title="${formatCurrency(totalIn)}">${formatCurrency(totalIn)}</div>
        </div>
        <div onclick="setFilterJenis('Pengeluaran')" class="cursor-pointer bg-surface-card-dark rounded-xl p-5 md:p-6 border ${window.filterJenis === 'Pengeluaran' ? 'border-trading-down ring-1 ring-trading-down' : 'border-hairline-on-dark'} hover:border-trading-down transition">
          <h3 class="text-muted text-xs md:text-sm font-semibold mb-2 uppercase tracking-wide">Total Pengeluaran</h3>
          <div class="font-tabular text-2xl md:text-3xl font-bold text-trading-down truncate" title="${formatCurrency(totalOut)}">${formatCurrency(totalOut)}</div>
        </div>
      </div>

      <div id="pdf-content" class="space-y-6 md:space-y-8">
        <!-- Charts Section -->
        <div id="charts-section" class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <div class="bg-surface-card-dark rounded-xl border border-hairline-on-dark p-5 md:p-6 shadow-sm">
            <div class="mb-4">
              <h3 class="text-lg font-bold text-on-dark flex items-center gap-3">
                <span class="bg-emerald-500/20 p-1.5 rounded">${svgCurveIcon}</span> Tren Arus Kas
              </h3>
            </div>
            <div class="h-[250px] w-full relative">
              <canvas id="barChart"></canvas>
            </div>
          </div>
          
          <div class="bg-surface-card-dark rounded-xl border border-hairline-on-dark p-5 md:p-6 shadow-sm">
            <div class="mb-4">
              <h3 class="text-lg font-bold text-on-dark flex items-center gap-3">
                <span class="bg-blue-500/20 p-1.5 rounded">${svgPieIcon}</span> Persentase Pengeluaran
              </h3>
            </div>
            <div class="h-[250px] w-full relative flex justify-center">
              <canvas id="pieChart"></canvas>
            </div>
          </div>
        </div>

        <!-- Filtered Transactions Table -->
        <div class="bg-surface-card-dark rounded-xl border border-hairline-on-dark overflow-hidden">
          <div class="px-4 md:px-6 py-4 border-b border-hairline-on-dark flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 class="text-lg md:text-xl font-semibold text-on-dark">
              ${window.filterJenis === 'All' ? 'Semua Transaksi' : 'Transaksi ' + window.filterJenis}
            </h3>
            <div class="w-full sm:w-auto flex gap-2">
              <select onchange="setFilterKategori(this.value)" class="w-full sm:w-auto bg-surface-elevated-dark border border-hairline-on-dark text-on-dark rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary">
                <option value="All">Semua Kategori</option>
                ${uniqueCategories.map(c => `<option value="${c}" ${window.filterKategori === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="overflow-x-auto max-h-[500px]">
            <table class="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr class="text-muted text-xs uppercase tracking-wider border-b border-hairline-on-dark sticky top-0 bg-surface-card-dark z-10">
                  <th class="px-4 md:px-6 py-4 font-semibold">Tanggal</th>
                  <th class="px-4 md:px-6 py-4 font-semibold">Nama / Pihak</th>
                  <th class="px-4 md:px-6 py-4 font-semibold">Jenis / Kategori</th>
                  <th class="px-4 md:px-6 py-4 font-semibold">Keterangan</th>
                  <th class="px-4 md:px-6 py-4 font-semibold text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-hairline-on-dark">
                ${filteredTxs.length === 0 ? `
                  <tr><td colspan="5" class="px-4 py-8 text-center text-muted text-sm">Tidak ada transaksi.</td></tr>
                ` : filteredTxs.slice().reverse().map(tx => {
                  const isIncome = tx.jenis === 'Pemasukan';
                  const colorClass = isIncome ? 'text-trading-up' : 'text-trading-down';
                  const sign = isIncome ? '+' : '-';
                  return `
                  <tr class="hover:bg-surface-elevated-dark transition-colors group">
                    <td class="px-4 md:px-6 py-4 font-tabular text-sm text-body whitespace-nowrap">${tx.tanggal}</td>
                    <td class="px-4 md:px-6 py-4 text-sm font-medium text-on-dark whitespace-nowrap">${tx.nama}</td>
                    <td class="px-4 md:px-6 py-4 text-sm text-muted whitespace-nowrap">
                      <span class="pdf-badge inline-block px-2 py-1 bg-surface-elevated-dark rounded text-xs mr-2 font-semibold ${isIncome ? 'text-trading-up' : 'text-trading-down'}">${tx.jenis}</span>
                      <span>${tx.kategori}</span>
                    </td>
                    <td class="px-4 md:px-6 py-4 text-sm text-body truncate max-w-[200px]" title="${tx.keterangan || '-'}">${tx.keterangan || '-'}</td>
                    <td class="px-4 md:px-6 py-4 font-tabular text-sm font-bold text-right ${colorClass} whitespace-nowrap">
                      ${sign} ${formatCurrency(tx.jumlah)}
                    </td>
                  </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    const ctxBar = document.getElementById('barChart');
    const ctxPie = document.getElementById('pieChart');

    if (ctxBar && ctxPie) {
      if (barChartInstance) barChartInstance.destroy();
      if (pieChartInstance) pieChartInstance.destroy();

      Chart.defaults.color = '#707a8a';
      Chart.defaults.font.family = 'Inter, sans-serif';

      let dateLabels = [];
      let inData = [];
      let outData = [];

      if (window.dateFilterType === 'Bulan') {
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
          const d = new Date(now.getFullYear(), now.getMonth(), i);
          const str = `${d.getDate().toString().padStart(2, '0')}-${d.toLocaleString('id-ID', { month: 'short' })}-${d.getFullYear()}`;
          dateLabels.push(str);
          inData.push(dateMap[str] ? dateMap[str].in : 0);
          outData.push(dateMap[str] ? dateMap[str].out : 0);
        }
      } else if (window.dateFilterType === 'Minggu') {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        for (let i = 0; i < 7; i++) {
          const d = new Date(now.getFullYear(), now.getMonth(), diff + i);
          const str = `${d.getDate().toString().padStart(2, '0')}-${d.toLocaleString('id-ID', { month: 'short' })}-${d.getFullYear()}`;
          dateLabels.push(str);
          inData.push(dateMap[str] ? dateMap[str].in : 0);
          outData.push(dateMap[str] ? dateMap[str].out : 0);
        }
      } else {
        dateLabels = Object.keys(dateMap).sort((a, b) => parseDateStr(a) - parseDateStr(b));
        
        // Add previous date if only one point exists so the line draws
        if (dateLabels.length === 1) {
          const singleDate = parseDateStr(dateLabels[0]);
          const prevDate = new Date(singleDate);
          prevDate.setDate(prevDate.getDate() - 1);
          const str = `${String(prevDate.getDate()).padStart(2, '0')}-${prevDate.toLocaleString('id-ID', { month: 'short' })}-${prevDate.getFullYear()}`;
          dateLabels.unshift(str);
          dateMap[str] = { in: 0, out: 0 };
        }

        inData = dateLabels.map(d => dateMap[d].in);
        outData = dateLabels.map(d => dateMap[d].out);
      }

      barChartInstance = new Chart(ctxBar, {
        type: 'line',
        data: {
          labels: dateLabels.length > 0 ? dateLabels : ['Belum ada data'],
          datasets: [
            {
              label: 'Pemasukan',
              data: dateLabels.length > 0 ? inData : [0],
              borderColor: '#0ecb81',
              backgroundColor: 'rgba(14, 203, 129, 0.1)',
              borderWidth: 2,
              tension: 0.4,
              fill: true,
              pointBackgroundColor: '#0ecb81',
            },
            {
              label: 'Pengeluaran',
              data: dateLabels.length > 0 ? outData : [0],
              borderColor: '#f6465d',
              backgroundColor: 'rgba(246, 70, 93, 0.1)',
              borderWidth: 2,
              tension: 0.4,
              fill: true,
              pointBackgroundColor: '#f6465d',
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 6 } }
          },
          scales: {
            y: { 
              beginAtZero: true, 
              suggestedMax: dateLabels.length > 0 ? undefined : 1000000,
              grid: { color: '#2b3139' }, 
              ticks: { 
                maxTicksLimit: 4,
                display: dateLabels.length > 0,
                callback: (value) => 'Rp ' + (value/1000000) + ' Jt' 
              } 
            },
            x: { grid: { display: false } }
          }
        }
      });

      const catLabels = Object.keys(expenseCategories);
      const catData = Object.values(expenseCategories);
      const pieColors = ['#fcd535', '#f0b90b', '#707a8a', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4'];

      pieChartInstance = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
          labels: catLabels.length > 0 ? catLabels : ['Belum ada data'],
          datasets: [{
            data: catLabels.length > 0 ? catData : [1],
            backgroundColor: catLabels.length > 0 ? pieColors : ['#2b3139'],
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 6 } }
          }
        }
      });
    }
  }, 0);
}

window.setDateFilter = (type) => {
  window.dateFilterType = type;
  ['Semua', 'Hari', 'Minggu', 'Bulan', 'Custom'].forEach(t => {
    const btn = document.getElementById('btn-filter-' + t);
    if (btn) {
      if (t === type) {
        btn.className = 'px-4 py-1.5 rounded-full text-sm font-medium transition-colors bg-primary text-on-primary whitespace-nowrap';
      } else {
        btn.className = 'px-4 py-1.5 rounded-full text-sm font-medium transition-colors bg-surface-elevated-dark text-body hover:text-on-dark border border-hairline-on-dark whitespace-nowrap';
      }
    }
  });
  
  if (type === 'Custom') {
    document.getElementById('custom-date-inputs').classList.remove('hidden');
  } else {
    document.getElementById('custom-date-inputs').classList.add('hidden');
    render();
  }
};

window.applyCustomDate = () => {
  window.customStartDate = document.getElementById('filter-start-date').value;
  window.customEndDate = document.getElementById('filter-end-date').value;
  render();
};

async function renderTransactions() {
  const txs = await getFilteredTransactions();
  const cats = await getCategoryList();
  
  appDiv.innerHTML = `
    <div class="space-y-4 md:space-y-6 animate-fade-in">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 class="text-2xl font-bold text-on-dark">Manajemen Transaksi</h2>
          <p class="text-body mt-1">Tambah, edit, atau hapus entri pembukuan.</p>
        </div>
        <button onclick="openTxModal()" class="bg-primary hover:bg-primary-active text-on-primary px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm w-full sm:w-auto flex justify-center items-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
          Transaksi Baru
        </button>
      </div>

      <div class="bg-surface-card-dark rounded-xl border border-hairline-on-dark shadow-sm overflow-hidden">
        <div class="px-4 py-4 md:px-6 border-b border-hairline-on-dark flex flex-wrap gap-3 bg-surface-elevated-dark/50">
          <select id="full-cat-filter" onchange="window.setFilterKategori(this.value)" class="bg-surface-elevated-dark border border-hairline-on-dark text-on-dark text-sm rounded-md px-3 py-2 focus:outline-none focus:border-primary w-full sm:w-auto">
            <option value="All">Semua Kategori</option>
            ${cats.map(c => `<option value="${c}" ${window.filterKategori === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
          <select id="full-jenis-filter" onchange="window.setFilterJenis(this.value)" class="bg-surface-elevated-dark border border-hairline-on-dark text-on-dark text-sm rounded-md px-3 py-2 focus:outline-none focus:border-primary w-full sm:w-auto">
            <option value="All">Semua Jenis</option>
            <option value="Pemasukan" ${window.filterJenis === 'Pemasukan' ? 'selected' : ''}>Pemasukan</option>
            <option value="Pengeluaran" ${window.filterJenis === 'Pengeluaran' ? 'selected' : ''}>Pengeluaran</option>
          </select>
        </div>
        <div class="overflow-x-auto min-h-[400px]">
          <table class="w-full text-sm text-left whitespace-nowrap min-w-[800px]">
            <thead class="text-xs text-muted uppercase bg-surface-elevated-dark border-b border-hairline-on-dark">
              <tr>
                <th scope="col" class="px-4 py-3 md:px-6">Tanggal</th>
                <th scope="col" class="px-4 py-3 md:px-6">Nama / Pihak</th>
                <th scope="col" class="px-4 py-3 md:px-6">Jenis & Kategori</th>
                <th scope="col" class="px-4 py-3 md:px-6">Keterangan</th>
                <th scope="col" class="px-4 py-3 md:px-6 text-right">Harga</th>
                <th scope="col" class="px-4 py-3 md:px-6 text-center">QTY</th>
                <th scope="col" class="px-4 py-3 md:px-6 text-right">Jumlah</th>
                <th scope="col" class="px-4 py-3 md:px-6 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-hairline-on-dark">
              ${txs.length === 0 ? '<tr><td colspan="8" class="px-6 py-8 text-center text-muted">Belum ada transaksi.</td></tr>' : ''}
              ${txs.map(tx => {
                const isIncome = tx.jenis === 'Pemasukan';
                return `
                <tr class="hover:bg-surface-elevated-dark transition-colors group">
                  <td class="px-4 md:px-6 py-3 font-tabular text-body">${tx.tanggal}</td>
                  <td class="px-4 md:px-6 py-3 font-semibold text-on-dark">${tx.nama}</td>
                  <td class="px-4 md:px-6 py-3">
                    <div class="flex flex-col gap-1">
                      <span class="w-max px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isIncome ? 'bg-trading-up/20 text-trading-up' : 'bg-trading-down/20 text-trading-down'}">${tx.jenis}</span>
                      <span class="text-xs text-muted">${tx.kategori || '-'}</span>
                    </div>
                  </td>
                  <td class="px-4 md:px-6 py-3 text-muted truncate max-w-[150px]" title="${tx.keterangan}">${tx.keterangan || '-'}</td>
                  <td class="px-4 md:px-6 py-3 text-right font-tabular text-body">${formatCurrency(tx.harga)}</td>
                  <td class="px-4 md:px-6 py-3 text-center font-tabular text-body">${tx.qty}</td>
                  <td class="px-4 md:px-6 py-3 text-right font-tabular font-bold ${isIncome ? 'text-trading-up' : 'text-trading-down'}">
                    ${formatCurrency(tx.jumlah)}
                  </td>
                  <td class="px-4 md:px-6 py-3 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="editTx('${tx.id}')" class="text-primary hover:text-primary-active mr-3 font-medium">Edit</button>
                    <button onclick="deleteTx('${tx.id}')" class="text-trading-down hover:text-red-400 font-medium">Hapus</button>
                  </td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

async function renderCategories() {
  const cats = await getCategoryList();
  appDiv.innerHTML = `
    <div class="space-y-4 md:space-y-6 animate-fade-in">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 class="text-2xl font-bold text-on-dark">Kategori</h2>
          <p class="text-body mt-1">Kelola kategori untuk transaksi pemasukan & pengeluaran.</p>
        </div>
        <button onclick="openCatModal()" class="bg-surface-elevated-dark hover:bg-surface-card-dark border border-hairline-on-dark text-on-dark px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm w-full sm:w-auto flex justify-center items-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
          Kategori Baru
        </button>
      </div>

      <div class="bg-surface-card-dark rounded-xl border border-hairline-on-dark shadow-sm overflow-hidden">
        <div class="overflow-x-auto min-h-[250px]">
          <table class="w-full text-sm text-left whitespace-nowrap min-w-[500px]">
            <thead class="text-xs text-muted uppercase bg-surface-elevated-dark border-b border-hairline-on-dark">
              <tr>
                <th scope="col" class="px-4 py-3 md:px-6 w-12">No</th>
                <th scope="col" class="px-4 py-3 md:px-6">Nama Kategori</th>
                <th scope="col" class="px-4 py-3 md:px-6 text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-hairline-on-dark">
              ${cats.map((cat, idx) => `
                <tr class="hover:bg-surface-elevated-dark transition-colors group">
                  <td class="px-4 md:px-6 py-3 font-tabular text-sm text-muted">${idx + 1}</td>
                  <td class="px-4 md:px-6 py-3 text-sm text-on-dark font-medium">${cat}</td>
                  <td class="px-4 md:px-6 py-3 text-center">
                    <button onclick="editCategory('${cat}')" class="text-primary hover:text-primary-active text-sm font-medium mr-3">Edit</button>
                    <button onclick="deleteCategory('${cat}')" class="text-trading-down hover:text-red-400 text-sm font-medium">Hapus</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

async function renderUsers() {
  const users = await getUsersList();
  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
  
  if (currentUser.role !== 'admin') {
    appDiv.innerHTML = '<div class="text-center py-20 text-trading-down font-bold text-xl">Akses Ditolak. Anda bukan Admin.</div>';
    return;
  }

  appDiv.innerHTML = `
    <div class="space-y-4 md:space-y-6 animate-fade-in">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 class="text-2xl font-bold text-on-dark flex items-center gap-2"><svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg> Manajemen Pengguna</h2>
          <p class="text-body mt-1">Kelola akses akun staf & admin.</p>
        </div>
        <button onclick="openUserModal()" class="bg-primary hover:bg-primary-active text-on-primary px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm w-full sm:w-auto flex justify-center items-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
          Tambah User
        </button>
      </div>

      <div class="bg-surface-card-dark rounded-xl border border-hairline-on-dark shadow-sm overflow-hidden mb-6">
        <div class="overflow-x-auto min-h-[250px]">
          <table class="w-full text-sm text-left whitespace-nowrap min-w-[600px]">
            <thead class="text-xs text-muted uppercase bg-surface-elevated-dark border-b border-hairline-on-dark">
              <tr>
                <th scope="col" class="px-4 py-3 md:px-6 w-12">No</th>
                <th scope="col" class="px-4 py-3 md:px-6">Username</th>
                <th scope="col" class="px-4 py-3 md:px-6">Role</th>
                <th scope="col" class="px-4 py-3 md:px-6 text-center w-32">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-hairline-on-dark">
              ${users.map((u, idx) => `
                <tr class="hover:bg-surface-elevated-dark transition-colors">
                  <td class="px-4 md:px-6 py-3 font-tabular text-sm text-muted">${idx + 1}</td>
                  <td class="px-4 md:px-6 py-3 text-sm text-on-dark font-bold whitespace-nowrap">${u.username} ${u.username === currentUser.username ? '<span class="text-xs font-normal text-primary ml-2">(Anda)</span>' : ''}</td>
                  <td class="px-4 md:px-6 py-3 text-sm text-body whitespace-nowrap"><span class="px-2 py-1 rounded text-xs font-semibold ${u.role === 'admin' ? 'bg-primary/20 text-primary' : 'bg-surface-card-dark border border-hairline-on-dark'}">${u.role.toUpperCase()}</span></td>
                  <td class="px-4 md:px-6 py-3 text-center">
                    <button onclick="editUserPrompt('${u.username}')" class="text-primary hover:text-primary-active text-sm font-semibold mr-3">Edit</button>
                    ${u.username !== 'admin' ? `<button onclick="deleteUser('${u.username}')" class="text-trading-down hover:text-red-400 text-sm font-semibold">Hapus</button>` : `<span class="text-muted text-sm italic">Permanen</span>`}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

window.openUserModal = () => {
  document.getElementById('userOldUsername').value = '';
  document.getElementById('userUsername').value = '';
  document.getElementById('userPassword').value = '';
  document.getElementById('userPassword').placeholder = 'Minimal 4 karakter';
  document.getElementById('userPassword').required = true;
  document.getElementById('userRole').value = 'user';
  document.getElementById('userModalTitle').innerText = 'Tambah User Baru';
  document.getElementById('userModal').classList.remove('hidden');
  document.getElementById('userModal').classList.add('flex');
};

window.closeUserModal = () => {
  document.getElementById('userModal').classList.add('hidden');
  document.getElementById('userModal').classList.remove('flex');
};

window.editUserPrompt = async (oldUsername) => {
  const users = await getUsersList();
  const user = users.find(u => u.username === oldUsername);
  if (!user) return;

  document.getElementById('userOldUsername').value = user.username;
  document.getElementById('userUsername').value = user.username;
  document.getElementById('userPassword').value = '';
  document.getElementById('userPassword').placeholder = 'Kosongkan jika tidak ingin ganti password';
  document.getElementById('userPassword').required = false;
  document.getElementById('userRole').value = user.role;
  document.getElementById('userModalTitle').innerText = 'Edit User: ' + user.username;
  
  if (user.username === 'admin') {
    document.getElementById('userUsername').disabled = true;
    document.getElementById('userRole').disabled = true;
  } else {
    document.getElementById('userUsername').disabled = false;
    document.getElementById('userRole').disabled = false;
  }

  document.getElementById('userModal').classList.remove('hidden');
  document.getElementById('userModal').classList.add('flex');
};

window.saveUser = async (e) => {
  e.preventDefault();
  const btn = document.querySelector('#userForm button[type="submit"]');
  btn.innerHTML = 'Menyimpan...';
  
  const oldUsername = document.getElementById('userOldUsername').value;
  const username = document.getElementById('userUsername').value.trim();
  const password = document.getElementById('userPassword').value;
  const role = document.getElementById('userRole').value;

  if (username === '') return;
  const users = await getUsersList();
  
  if (oldUsername) {
    if (users.some((u) => u.username === username && u.username !== oldUsername)) {
      alert("Username tersebut sudah dipakai.");
      btn.innerHTML = 'Simpan';
      return;
    }
    const payload = { username };
    if (password !== '') payload.password = password;
    if (oldUsername !== 'admin') payload.role = role;
    await supabase.from('app_users').update(payload).eq('username', oldUsername);
  } else {
    if (users.some(u => u.username === username)) {
      alert("Username tersebut sudah dipakai.");
      btn.innerHTML = 'Simpan';
      return;
    }
    if (password.length < 4) {
      alert("Password minimal 4 karakter.");
      btn.innerHTML = 'Simpan';
      return;
    }
    await supabase.from('app_users').insert([{ username, password, role }]);
  }

  closeUserModal();
  render();
};

window.deleteUser = async (username) => {
  if (username === 'admin') return;
  if (confirm(`Apakah Anda yakin ingin menghapus user "${username}"?`)) {
    await supabase.from('app_users').delete().eq('username', username);
    render();
  }
};

async function renderSettings() {
  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
  const accs = await getAccountList();
  
  appDiv.innerHTML = `
    <div class="space-y-6 md:space-y-8 animate-fade-in">
      <div>
        <h2 class="text-2xl font-bold text-on-dark">Pengaturan</h2>
        <p class="text-body mt-1">Kelola akun pribadi dan dompet bisnis.</p>
      </div>

      <div class="bg-surface-card-dark rounded-xl border border-hairline-on-dark p-6 shadow-sm">
        <h3 class="text-lg font-bold text-on-dark mb-4">Informasi Akun</h3>
        <div class="grid grid-cols-2 gap-4 max-w-sm">
          <div class="text-muted text-sm font-medium">Username</div>
          <div class="text-on-dark text-sm font-bold">${currentUser.username}</div>
          <div class="text-muted text-sm font-medium">Role Akses</div>
          <div class="text-on-dark text-sm font-bold uppercase text-primary">${currentUser.role}</div>
        </div>
      </div>

      <!-- Kelola Dompet -->
      <div class="bg-surface-card-dark rounded-xl border border-hairline-on-dark p-6 shadow-sm">
        <h3 class="text-lg font-bold text-on-dark mb-4 flex items-center gap-2">
          <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
          Kelola Dompet / Toko
        </h3>
        <div class="space-y-2">
          ${accs.map(acc => `
            <div class="flex items-center justify-between bg-surface-elevated-dark rounded-lg px-4 py-3 border border-hairline-on-dark">
              <span class="text-on-dark text-sm font-medium">${acc}</span>
              <div class="flex items-center gap-2">
                <button onclick="renameAccount('${acc}')" class="text-primary hover:text-primary-active text-xs font-semibold px-2 py-1 rounded border border-primary/30 hover:bg-primary/10 transition-colors">Rename</button>
                <button onclick="deleteAccount('${acc}')" class="text-trading-down hover:text-red-400 text-xs font-semibold px-2 py-1 rounded border border-red-500/30 hover:bg-red-500/10 transition-colors">Hapus</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Zona Berbahaya -->
      ${currentUser.role === 'admin' ? `
      <div class="bg-red-950/20 border border-red-900/50 rounded-xl p-5 md:p-6 shadow-sm">
        <h3 class="text-lg font-bold text-trading-down mb-2 flex items-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          Zona Berbahaya - Reset Data Transaksi
        </h3>
        <p class="text-sm text-body mb-4">Peringatan: Menekan tombol ini akan menghapus <strong>seluruh data transaksi keuangan secara permanen</strong>. Kategori dan dompet tetap aman. Semua saldo akan menjadi NOL.</p>
        <button onclick="resetPersonalData()" class="bg-trading-down hover:bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-colors shadow-sm w-full sm:w-auto">
          Reset Data Transaksi
        </button>
      </div>
      ` : ''}
    </div>
  `;
}

window.resetPersonalData = async () => {
  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
  if(!currentUser.username || currentUser.role !== 'admin') return;
  
  if (confirm("PERINGATAN KERAS! Anda yakin ingin MENGHAPUS SEMUA DATA TRANSAKSI? Kategori dan dompet tetap aman. Aksi ini tidak dapat dibatalkan!")) {
    if (confirm("Silakan konfirmasi sekali lagi. Yakin ingin MENGHAPUS SEMUA TRANSAKSI?")) {
      // Fetch all transaction IDs then delete one by one
      const { data: txs } = await supabase.from('transactions').select('id');
      if (txs && txs.length > 0) {
        const ids = txs.map(t => t.id);
        await supabase.from('transactions').delete().in('id', ids);
      }
      
      window.activeAccount = 'Semua Akun';
      localStorage.setItem('active_account', 'Semua Akun');
      window.dateFilterType = 'Semua';
      
      alert("Semua data transaksi berhasil direset menjadi NOL. Kategori dan dompet tetap tersimpan.");
      navigateTo('dashboard');
    }
  }
};

window.renameAccount = async (oldName) => {
  const newName = prompt(`Ganti nama dompet "${oldName}" menjadi:`, oldName);
  if (!newName || newName.trim() === '' || newName.trim() === oldName) return;
  
  const accs = await getAccountList();
  if (accs.includes(newName.trim())) {
    alert('Nama dompet tersebut sudah ada.');
    return;
  }
  
  await supabase.from('accounts').update({ name: newName.trim() }).eq('name', oldName);
  await supabase.from('transactions').update({ akun: newName.trim() }).eq('akun', oldName);
  
  if (window.activeAccount === oldName) {
    window.activeAccount = newName.trim();
    localStorage.setItem('active_account', newName.trim());
  }
  
  render();
};

window.deleteAccount = async (name) => {
  const accs = await getAccountList();
  if (accs.length <= 1) {
    alert('Tidak bisa menghapus dompet terakhir. Minimal harus ada 1 dompet.');
    return;
  }
  if (confirm(`Hapus dompet "${name}"? Semua transaksi di dompet ini juga akan dihapus.`)) {
    await supabase.from('transactions').delete().eq('akun', name);
    await supabase.from('accounts').delete().eq('name', name);
    
    if (window.activeAccount === name) {
      window.activeAccount = 'Semua Akun';
      localStorage.setItem('active_account', 'Semua Akun');
    }
    render();
  }
};

window.exportToExcel = async () => {
  const txs = await getFilteredTransactions();
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Laporan Kas');

  worksheet.mergeCells('A1:J1');
  worksheet.getCell('A1').value = 'LAPORAN ARUS KAS ENTERPRISE';
  worksheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF181A20' } };
  worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };

  worksheet.getCell('A3').value = 'Filter Akun:';
  worksheet.getCell('B3').value = window.activeAccount;
  worksheet.getCell('A4').value = 'Rentang Waktu:';
  
  let rentangStr = window.dateFilterType;
  if (window.dateFilterType === 'Custom') rentangStr = `${window.customStartDate} s/d ${window.customEndDate}`;
  worksheet.getCell('B4').value = rentangStr;

  let totalIn = 0;
  let totalOut = 0;
  txs.forEach(tx => {
    if (tx.jenis === 'Pemasukan') totalIn += Number(tx.jumlah);
    else totalOut += Number(tx.jumlah);
  });

  worksheet.getCell('B5').value = 'Total Pemasukan:';
  worksheet.getCell('C5').value = totalIn;
  worksheet.getCell('C5').numFmt = '[Color10]"Rp"#,##0';
  
  worksheet.getCell('B6').value = 'Total Pengeluaran:';
  worksheet.getCell('C6').value = totalOut;
  worksheet.getCell('C6').numFmt = '[Red]\\-"Rp"#,##0';
  
  worksheet.getCell('B7').value = 'Total Saldo:';
  worksheet.getCell('C7').value = totalIn - totalOut;
  worksheet.getCell('C7').numFmt = '"Rp"#,##0';

  worksheet.getCell('B5').font = { bold: true };
  worksheet.getCell('B6').font = { bold: true };
  worksheet.getCell('B7').font = { bold: true };

  const headers = ['No', 'Tanggal', 'Akun', 'Nama / Pihak', 'Jenis', 'Kategori', 'Keterangan', 'Harga', 'QTY', 'Total Jumlah'];
  
  const tableStartRow = 9;
  const headerRow = worksheet.getRow(tableStartRow);
  headerRow.values = headers;
  
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF000000' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCD535' } }; 
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });

  worksheet.columns = [
    { width: 6 },   // No
    { width: 15 },  // Tanggal
    { width: 20 },  // Akun
    { width: 30 },  // Nama
    { width: 15 },  // Jenis
    { width: 20 },  // Kategori
    { width: 35 },  // Keterangan
    { width: 18, style: { numFmt: '[Color10]"Rp"#,##0;[Red]\\-"Rp"#,##0' } },  // Harga
    { width: 8, style: { alignment: { horizontal: 'center' } } },    // QTY
    { width: 22, style: { numFmt: '[Color10]"Rp"#,##0;[Red]\\-"Rp"#,##0', font: { bold: true } } }   // Jumlah
  ];

  txs.slice().reverse().forEach((tx, idx) => {
    const isIncome = tx.jenis === 'Pemasukan';
    const multiplier = isIncome ? 1 : -1;
    
    const row = worksheet.addRow([
      idx + 1,
      tx.tanggal,
      tx.akun || 'Dompet Utama',
      tx.nama,
      tx.jenis,
      tx.kategori,
      tx.keterangan || '-',
      Number(tx.harga) * multiplier,
      Number(tx.qty),
      Number(tx.jumlah) * multiplier
    ]);
    
    row.eachCell((cell, colNumber) => {
      cell.border = { top: { style: 'hair' }, left: { style: 'hair' }, bottom: { style: 'hair' }, right: { style: 'hair' } };
      if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }; 
      if (colNumber === 5) cell.font = { color: { argb: isIncome ? 'FF059669' : 'FFDC2626' }, bold: true };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, "ArginStore_Financial_Report.xlsx");
};

window.exportToPDF = () => {
  const element = document.getElementById('pdf-content');
  if (!element) {
    alert("Silakan buka halaman Dashboard untuk mengekspor PDF.");
    return;
  }
  
  const clone = element.cloneNode(true);
  const chartsSection = clone.querySelector('#charts-section');
  if (chartsSection) {
    chartsSection.remove();
  }
  
  const wrapper = document.createElement('div');
  wrapper.style.backgroundColor = '#0b0c10'; 
  wrapper.style.padding = '20px';
  wrapper.appendChild(clone);

  const opt = {
    margin:       [10, 10, 10, 10],
    filename:     'ArginStore_Financial_Report.pdf',
    image:        { type: 'jpeg', quality: 1.0 },
    html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#0b0c10' },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
  };
  
  html2pdf().set(opt).from(wrapper).save();
};

window.openTxModal = async () => {
  const cats = await getCategoryList();
  const accs = await getAccountList();
  
  document.getElementById('txId').value = '';
  document.getElementById('txTanggal').value = new Date().toISOString().split('T')[0];
  document.getElementById('txJenis').value = 'Pemasukan';
  document.getElementById('txPihak').value = '';
  document.getElementById('txKeterangan').value = '';
  document.getElementById('txHarga').value = '';
  document.getElementById('txQty').value = '1';
  document.getElementById('txJumlah').value = '';
  document.getElementById('txModalTitle').innerText = 'Transaksi Baru';
  
  const katSelect = document.getElementById('txKategori');
  katSelect.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
  
  const accSelect = document.getElementById('txAkun');
  accSelect.innerHTML = accs.map(a => `<option value="${a}" ${a === window.activeAccount ? 'selected' : ''}>${a}</option>`).join('');

  toggleTxCategory();
  document.getElementById('txModal').classList.remove('hidden');
};

window.formatAndCalculateTotal = () => {
  const hargaEl = document.getElementById('txHarga');
  const qtyEl = document.getElementById('txQty');
  const jumlahEl = document.getElementById('txJumlah');
  
  // Format string '1000' -> '1.000'
  let val = hargaEl.value.replace(/\D/g, '');
  if (val !== '') {
    val = parseInt(val, 10).toLocaleString('id-ID');
  }
  hargaEl.value = val;
  
  const h = Number(val.replace(/\D/g, '')) || 0;
  const q = Number(qtyEl.value) || 0;
  const total = h * q;
  jumlahEl.value = total > 0 ? total.toLocaleString('id-ID') : '';
};

window.closeTxModal = () => {
  document.getElementById('txModal').classList.add('hidden');
};

window.toggleTxCategory = () => {
  const wrapper = document.getElementById('kategoriWrapper');
  if (wrapper) wrapper.classList.remove('hidden');
};

window.saveTransaction = async (e) => {
  e.preventDefault();
  const btn = document.querySelector('#txForm button[type="submit"]');
  btn.innerHTML = 'Menyimpan...';
  
  const user = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
  
  const id = document.getElementById('txId').value;
  const d = new Date(document.getElementById('txTanggal').value);
  const strDate = `${d.getDate().toString().padStart(2, '0')}-${d.toLocaleString('id-ID', { month: 'short' })}-${d.getFullYear()}`;
  
  const payload = {
    user_id: getCurrentUsername(),
    tanggal: strDate,
    jenis: document.getElementById('txJenis').value,
    nama: document.getElementById('txPihak').value,
    kategori: document.getElementById('txKategori').value,
    keterangan: document.getElementById('txKeterangan').value,
    harga: Number(document.getElementById('txHarga').value.replace(/\D/g, '')),
    qty: Number(document.getElementById('txQty').value) || 1,
    jumlah: Number(document.getElementById('txJumlah').value.replace(/\D/g, '')),
    akun: document.getElementById('txAkun').value
  };

  if (id) {
    await supabase.from('transactions').update(payload).eq('id', id);
  } else {
    await supabase.from('transactions').insert([payload]);
  }

  btn.innerHTML = 'Simpan';
  closeTxModal();
  render();
};

window.editTx = async (id) => {
  const txs = await getTransactions();
  const tx = txs.find(t => t.id == id);
  if (!tx) return;
  
  await openTxModal();
  
  document.getElementById('txId').value = tx.id;
  document.getElementById('txModalTitle').innerText = 'Edit Transaksi';
  
  const parts = tx.tanggal.split('-');
  const months = { 'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'Mei': '05', 'Jun': '06', 'Jul': '07', 'Agt': '08', 'Sep': '09', 'Okt': '10', 'Nov': '11', 'Des': '12' };
  document.getElementById('txTanggal').value = `${parts[2]}-${months[parts[1]]}-${parts[0]}`;
  
  document.getElementById('txJenis').value = tx.jenis;
  document.getElementById('txPihak').value = tx.nama;
  document.getElementById('txKeterangan').value = tx.keterangan;
  document.getElementById('txHarga').value = tx.harga ? tx.harga.toLocaleString('id-ID') : '';
  document.getElementById('txQty').value = tx.qty || 1;
  window.formatAndCalculateTotal();
  
  toggleTxCategory();
  document.getElementById('txKategori').value = tx.kategori;
  if (tx.akun) document.getElementById('txAkun').value = tx.akun;
};

window.deleteTx = async (id) => {
  if (confirm('Hapus transaksi ini?')) {
    await supabase.from('transactions').delete().eq('id', id);
    render();
  }
};

window.openCatModal = () => {
  document.getElementById('catOldName').value = '';
  document.getElementById('catName').value = '';
  document.getElementById('catModalTitle').innerText = 'Kategori Baru';
  document.getElementById('catModal').classList.remove('hidden');
};

window.closeCatModal = () => {
  document.getElementById('catModal').classList.add('hidden');
};

window.editCategory = (oldName) => {
  document.getElementById('catOldName').value = oldName;
  document.getElementById('catName').value = oldName;
  document.getElementById('catModalTitle').innerText = 'Edit Kategori';
  document.getElementById('catModal').classList.remove('hidden');
};

window.saveCategory = async (e) => {
  e.preventDefault();
  const btn = document.querySelector('#catForm button[type="submit"]');
  btn.innerHTML = 'Menyimpan...';
  
  const oldName = document.getElementById('catOldName').value;
  const name = document.getElementById('catName').value.trim();
  if (name === '') return;

  const cats = await getCategoryList();
  
  if (oldName) {
    // Edit mode
    if (name !== oldName && cats.includes(name)) {
      alert("Kategori sudah ada!");
      btn.innerHTML = 'Simpan';
      return;
    }
    await supabase.from('categories').update({ name }).eq('name', oldName);
    // Update transactions that use the old category name
    await supabase.from('transactions').update({ kategori: name }).eq('kategori', oldName);
  } else {
    // Add mode
    if (cats.includes(name)) {
      alert("Kategori sudah ada!");
      btn.innerHTML = 'Simpan';
      return;
    }
    await supabase.from('categories').insert([{ user_id: getCurrentUsername(), name }]);
  }
  
  btn.innerHTML = 'Simpan';
  closeCatModal();
  render();
};

window.deleteCategory = async (name) => {
  if (confirm(`Hapus kategori "${name}"?`)) {
    await supabase.from('categories').delete().eq('name', name);
    render();
  }
};

checkAuth();
