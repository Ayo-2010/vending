const STORAGE_KEY = 'vending.machine.v1';
const $ = (id) => document.getElementById(id);

const SEED = [
  { code: 'A1', name: 'Melon Soda', price: 150, kind: 'can', color: '#65d46e', stock: 6 },
  { code: 'A2', name: 'Milk Tea', price: 160, kind: 'bottle', color: '#c78b53', stock: 4 },
  { code: 'A3', name: 'Cold Coffee', price: 170, kind: 'can', color: '#6f4a35', stock: 6 },
  { code: 'A4', name: 'Yuzu Water', price: 130, kind: 'bottle', color: '#f1cf52', stock: 3 },
  { code: 'B1', name: 'Ramune', price: 180, kind: 'bottle', color: '#6bc9e8', stock: 0 },
  { code: 'B2', name: 'Barley Tea', price: 120, kind: 'bottle', color: '#b68a3f', stock: 5 },
  { code: 'B3', name: 'Strawberry Milk', price: 160, kind: 'carton', color: '#f28a9a', stock: 4 },
  { code: 'B4', name: 'Grape Fizz', price: 150, kind: 'can', color: '#8f6ac8', stock: 6 },
  { code: 'C1', name: 'Green Tea', price: 130, kind: 'bottle', color: '#5a9b65', stock: 6 },
  { code: 'C2', name: 'Lemon Tonic', price: 140, kind: 'can', color: '#e8dc5b', stock: 2 },
  { code: 'C3', name: 'Cocoa', price: 170, kind: 'can', color: '#8a5842', stock: 0 },
  { code: 'C4', name: 'Peach Water', price: 150, kind: 'carton', color: '#f0a071', stock: 5 }
];

const state = {
  products: [],
  credit: 0,
  sales: [],
  admin: false
};

function freshProducts() {
  return SEED.map((item) => ({ ...item }));
}

function loadState() {
  state.products = freshProducts();
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored) return;
    if (Array.isArray(stored.products)) {
      state.products = state.products.map((item) => {
        const match = stored.products.find((entry) => entry.code === item.code);
        return match ? { ...item, stock: Math.max(0, Math.min(12, Number(match.stock) || 0)) } : item;
      });
    }
    if (Number.isFinite(stored.credit)) state.credit = Math.max(0, Number(stored.credit));
    if (Array.isArray(stored.sales)) state.sales = stored.sales.slice(0, 20);
    state.admin = Boolean(stored.admin);
  } catch (error) {}
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      products: state.products.map((item) => ({ code: item.code, stock: item.stock })),
      credit: state.credit,
      sales: state.sales,
      admin: state.admin
    }));
  } catch (error) {}
}

function money(value) {
  return `¥${Number(value).toLocaleString('en-GB')}`;
}

function timeLabel(value) {
  const date = new Date(value);
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function setStatus(message) {
  $('status').textContent = message;
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function productByCode(code) {
  return state.products.find((item) => item.code === code);
}

function productArt(product, compact = false) {
  return `<span class="can ${product.kind}" style="--can:${product.color}" aria-hidden="true"></span>`;
}

function renderProducts() {
  const grid = $('product-grid');
  grid.innerHTML = '';
  state.products.forEach((product) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `product${product.stock === 0 ? ' sold-out' : ''}${state.admin ? ' admin-ready' : ''}`;
    button.dataset.code = product.code;
    button.setAttribute('aria-label', `${product.code} ${product.name}, ${money(product.price)}, ${product.stock} in stock`);
    const dots = Array.from({ length: 6 }, (_, index) => `<i class="${index < Math.min(product.stock, 6) ? '' : 'empty'}"></i>`).join('');
    button.innerHTML = `
      ${productArt(product)}
      <span class="product-name">${product.name}</span>
      <span class="product-code">${product.code}</span>
      <span class="product-price">${money(product.price)}</span>
      <span class="stock-dots" aria-hidden="true">${dots}</span>
      ${product.stock === 0 ? '<span class="sold-label">Sold out</span>' : ''}
    `;
    button.addEventListener('click', () => handleProduct(product.code));
    grid.appendChild(button);
  });
}

function renderKeypad() {
  const keypad = $('keypad');
  keypad.innerHTML = '';
  state.products.forEach((product) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'key';
    button.textContent = product.code;
    button.setAttribute('aria-label', `Buy ${product.name}`);
    button.addEventListener('click', () => purchase(product.code));
    keypad.appendChild(button);
  });
}

function renderCredit() {
  $('credit').textContent = money(state.credit);
}

function renderSales() {
  const list = $('sales');
  list.innerHTML = '';
  if (!state.sales.length) {
    list.innerHTML = '<li class="empty-sale">The tape is waiting for its first sale.</li>';
  } else {
    state.sales.slice(0, 8).forEach((sale) => {
      const item = document.createElement('li');
      item.innerHTML = `<strong>${sale.code} ${sale.name}</strong><span>${timeLabel(sale.time)} · ${money(sale.price)}</span>`;
      list.appendChild(item);
    });
  }
  const total = state.sales.reduce((sum, sale) => sum + sale.price, 0);
  $('sales-total').textContent = `${money(total)} today`;
  $('cans-sold').textContent = `${state.sales.length} can${state.sales.length === 1 ? '' : 's'} sold`;
}

function renderAdmin() {
  const button = $('restock');
  button.classList.toggle('active', state.admin);
  button.textContent = state.admin ? 'Restock mode: on' : 'Restock mode';
  if (state.admin) setStatus('Restock mode: tap a drink');
}

function renderTray(product) {
  const tray = $('tray');
  tray.innerHTML = `
    <div class="tray-item">
      ${productArt(product, true)}
      <div><strong>${product.name}</strong><span>${product.code} · ${money(product.price)}</span></div>
    </div>
  `;
  tray.classList.remove('dispensing');
  void tray.offsetWidth;
  tray.classList.add('dispensing');
}

function renderAll() {
  renderProducts();
  renderCredit();
  renderSales();
  renderAdmin();
}

function depositCoin(amount) {
  state.credit += amount;
  saveState();
  renderCredit();
  setStatus(`${money(amount)} inserted · ${money(state.credit)} credit`);
  showToast(`${money(amount)} inserted`);
}

function purchase(code) {
  const product = productByCode(code);
  if (!product) return;
  if (state.admin) {
    product.stock = 6;
    saveState();
    renderProducts();
    setStatus(`${product.name} restocked to 6`);
    showToast('Shelf restocked');
    return;
  }
  if (product.stock <= 0) {
    setStatus(`${product.name} is sold out`);
    showToast('Sold out');
    return;
  }
  if (state.credit < product.price) {
    setStatus(`Add ${money(product.price - state.credit)} for ${product.name}`);
    showToast('Not enough credit');
    return;
  }
  state.credit -= product.price;
  product.stock -= 1;
  state.sales.unshift({
    code: product.code,
    name: product.name,
    price: product.price,
    time: new Date().toISOString()
  });
  state.sales = state.sales.slice(0, 20);
  saveState();
  renderAll();
  renderTray(product);
  setStatus(`${product.name} dispensed · ${money(state.credit)} credit`);
  showToast('Enjoy your drink');
}

function handleProduct(code) {
  if (state.admin) {
    purchase(code);
    return;
  }
  purchase(code);
}

function returnChange() {
  if (state.credit <= 0) {
    setStatus('No credit to return');
    showToast('No change due');
    return;
  }
  const coins = [500, 100, 50, 10];
  let remaining = state.credit;
  const returned = [];
  coins.forEach((coin) => {
    while (remaining >= coin) {
      returned.push(coin);
      remaining -= coin;
    }
  });
  state.credit = 0;
  saveState();
  renderCredit();
  const tray = $('tray');
  tray.classList.remove('dispensing');
  tray.innerHTML = `<div class="tray-item"><div><strong>Change returned</strong><span>${returned.map((coin) => money(coin)).join(' · ')}</span></div></div>`;
  setStatus(`Returned ${money(returned.reduce((sum, coin) => sum + coin, 0))}`);
  showToast('Change returned');
}

function toggleRestock() {
  state.admin = !state.admin;
  saveState();
  renderAll();
  setStatus(state.admin ? 'Restock mode: tap a drink' : 'Restock mode off');
  showToast(state.admin ? 'Restock mode on' : 'Restock mode off');
}

function resetMachine() {
  if (!state.admin) {
    setStatus('Turn on restock mode to reset');
    showToast('Restock mode required');
    return;
  }
  if (!window.confirm('Reset stock, credit and the sales tape?')) return;
  state.products = freshProducts();
  state.credit = 0;
  state.sales = [];
  saveState();
  renderAll();
  $('tray').innerHTML = '<p>Your drink lands here.</p>';
  setStatus('Machine reset');
  showToast('Machine reset');
}

function bindEvents() {
  document.querySelectorAll('[data-coin]').forEach((button) => {
    button.addEventListener('click', () => depositCoin(Number(button.dataset.coin)));
  });
  $('change').addEventListener('click', returnChange);
  $('restock').addEventListener('click', toggleRestock);
  $('reset').addEventListener('click', resetMachine);
  $('print').addEventListener('click', () => {
    setStatus('Printing sales tape');
    window.print();
  });
  document.addEventListener('keydown', (event) => {
    if (event.target.matches('input, textarea')) return;
    const match = event.key.match(/^([abcABC])([1-4])$/);
    if (match) {
      event.preventDefault();
      purchase(`${match[1].toUpperCase()}${match[2]}`);
    }
  });
}

loadState();
bindEvents();
renderAll();
setStatus(state.credit ? `${money(state.credit)} credit ready` : 'Insert a coin to begin');
