/* ====== DINÁMITA POS v4.8 BODEGA – app.js ====== */
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money = n => new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN' }).format(Number(n || 0));
function downloadCSV(filename, rows){
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const DB = {
  key: 'dinamita-pos-v48',
  load(){
    try{
      const raw = localStorage.getItem(this.key);
      if(!raw) return this.seed();
      return this.migrate(JSON.parse(raw));
    }catch(e){
      console.warn('DB.load error', e);
      return this.seed();
    }
  },
  save(d){ localStorage.setItem(this.key, JSON.stringify(d)); },
  seed(){
    const demoProducts = [
      { sku:'BON-1LT', nombre:'Bonafont 1L',   stock:12, costo:8.5,  precio:15 },
      { sku:'CRE-300', nombre:'Creatina 300g', stock:5,  costo:220,  precio:320 },
      { sku:'PRO-2LB', nombre:'Proteína 2lb',  stock:7,  costo:420,  precio:620 },
      { sku:'GUA-XL',  nombre:'Guantes XL',    stock:10, costo:95,   precio:160 },
    ];
    const d = { products: demoProducts, sales: [], entradas: [], bodegaStock: {}, movimientosBodega: [], clients: [], config: {} };
    this.save(d); return d;
  },
  migrate(d){
    d.products = d.products || []; d.sales = d.sales || []; d.entradas = d.entradas || [];
    d.bodegaStock = d.bodegaStock || {}; d.movimientosBodega = d.movimientosBodega || [];
    d.clients = d.clients || []; d.config = d.config || {}; return d;
  }
};
let state = DB.load();

const UI = {
  current: 'dashboard',
  init(){
    document.querySelectorAll('.menu button').forEach(b => {
      b.onclick = () => {
        document.body.classList.remove('drawer-open');
        document.querySelectorAll('.menu button').forEach(x => x.classList.remove('active'));
        b.classList.add('active'); UI.show(b.dataset.view);
      };
    });
    const burger = document.getElementById('btnBurger');
    if(burger){ burger.onclick = () => document.body.classList.toggle('drawer-open'); }
    Dashboard.render(); Inventario.renderTabla(); Historial.renderTabla(); Reportes.renderAll?.();
    Bodega.init(); Clientes.renderTabla(); Ventas.renderCarrito();
  },
  show(id){
    UI.current = id;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('show'));
    const el = document.getElementById('view-' + id); if(el) el.classList.add('show');
    if(id === 'dashboard')  Dashboard.render();
    if(id === 'inventario') Inventario.renderTabla();
    if(id === 'historial')  Historial.renderTabla();
    if(id === 'reportes')   Reportes.renderAll?.();
    if(id === 'bodega')     { Bodega.renderStock(); Bodega.renderMovs(); }
    if(id === 'clientes')   Clientes.renderTabla();
    if(id === 'ventas')     Ventas.renderCarrito();
    if(id === 'ticket'){ const solo = document.getElementById('ticketAreaSolo'); if(solo && document.getElementById('ticketArea')) solo.innerHTML = document.getElementById('ticketArea').innerHTML; }
  }
};

const Dashboard = { render(){
  const el = document.getElementById('dashStats'); if(!el) return;
  const totalProds = state.products.length;
  const stockTotal = state.products.reduce((a,p) => a + (p.stock || 0), 0);
  const enBodega   = Object.values(state.bodegaStock || {}).reduce((a,b) => a + (b.qty || 0), 0);
  el.innerHTML = `<table><thead><tr><th>Métrica</th><th>Valor</th></tr></thead><tbody>
  <tr><td>Productos</td><td>${totalProds}</td></tr>
  <tr><td>Stock en inventario</td><td>${stockTotal}</td></tr>
  <tr><td>Stock en bodega</td><td>${enBodega}</td></tr>
  </tbody></table>`; } };

const Inventario = { renderTabla(){
  const el = document.getElementById('invTabla'); if(!el) return;
  const rows = state.products.map(p => `<tr><td>${esc(p.sku)}</td><td>${esc(p.nombre)}</td><td>${p.stock || 0}</td><td>${money(p.costo || 0)}</td><td>${money(p.precio || 0)}</td></tr>`).join('');
  el.innerHTML = `<table><thead><tr><th>SKU</th><th>Producto</th><th>Stock</th><th>Costo</th><th>Precio</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Sin productos</td></tr>'}</tbody></table>`;
} };

const Clientes = {
  agregar(){
    const nombre = document.getElementById('cliNombre').value.trim();
    const tel    = document.getElementById('cliTel').value.trim();
    const email  = document.getElementById('cliEmail').value.trim();
    if(!nombre) { alert('Nombre requerido'); return; }
    state.clients = state.clients || [];
    state.clients.unshift({ id:'C' + Date.now().toString().slice(-6), nombre, tel, email, fecha:new Date().toISOString() });
    DB.save(state);
    document.getElementById('cliNombre').value = '';
    document.getElementById('cliTel').value = '';
    document.getElementById('cliEmail').value = '';
    this.renderTabla();
  },
  renderTabla(term=''){
    term = (term || '').toLowerCase();
    const el = document.getElementById('cliTabla'); if(!el) return;
    const rows = (state.clients || [])
      .filter(c => (c.nombre + ' ' + (c.tel || '') + ' ' + (c.email || '')).toLowerCase().includes(term))
      .map(c => `<tr><td>${esc(c.id)}</td><td>${esc(c.nombre)}</td><td>${esc(c.tel || '')}</td><td>${esc(c.email || '')}</td><td>${(c.fecha || '').slice(0,10)}</td></tr>`).join('');
    el.innerHTML = `<table><thead><tr><th>ID</th><th>Nombre</th><th>Tel</th><th>Email</th><th>Alta</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Sin clientes</td></tr>'}</tbody></table>`;
  }
};

const Historial = { renderTabla(){
  const el = document.getElementById('histTabla'); if(!el) return;
  const rows = (state.sales || []).slice(0,50).map(s => `<tr><td>${esc(s.folio || '')}</td><td>${(s.fecha || '').slice(0,10)}</td><td>${money(s.total || 0)}</td></tr>`).join('');
  el.innerHTML = `<table><thead><tr><th>Folio</th><th>Fecha</th><th>Total</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Sin ventas</td></tr>'}</tbody></table>`;
} };

const Reportes = { renderAll(){ /* placeholder */ } };

const Bodega = {
  lote: [], selectedSku: '', _transferSku: null,
  init(){ const f = document.getElementById('bodFecha'); if(f) f.value = new Date().toISOString().slice(0,10); this.renderLote(); this.renderStock(); this.renderMovs(); },
  limpiar(){
    ['bodSearch','bodQty','bodCosto','bodProveedor','bodNotas'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    const q = document.getElementById('bodQty'); if(q) q.value = 1;
    const f = document.getElementById('bodFecha'); if(f) f.value = new Date().toISOString().slice(0,10);
    this.selectedSku = ''; const r = document.getElementById('bodResultados'); if(r) r.innerHTML = '';
  },
  buscarProducto(term, quick=false){
    term = (term || '').toLowerCase();
    const res = (state.products || []).filter(p => p.nombre.toLowerCase().includes(term) || (p.sku || '').toLowerCase().includes(term)).slice(0, 50);
    const wrap = document.getElementById(quick ? 'bodQuickResultados' : 'bodResultados'); if(!wrap) return;
    wrap.innerHTML = '';
    res.forEach(p => {
      const info = (state.bodegaStock?.[p.sku]) || { qty:0, costoProm:0 };
      const div = document.createElement('div'); div.className = 'list-item';
      div.innerHTML = `<div style="flex:1"><div><strong>${esc(p.nombre)}</strong></div><div class="sub">SKU: ${esc(p.sku)} • En bodega: ${info.qty} • Costo bodeg.: ${money(info.costoProm || 0)}</div></div><div><button class="btn small">Seleccionar</button></div>`;
      div.querySelector('button').onclick = () => {
        this.selectedSku = p.sku;
        if(!quick){ const x = document.getElementById('bodSearch'); if(x) x.value = p.nombre; } else { const y = document.getElementById('bodQuickSearch'); if(y) y.value = p.nombre; }
        wrap.innerHTML = '';
      };
      wrap.appendChild(div);
    });
  },
  addToLote(){
    if(!this.selectedSku){ alert('Selecciona un producto.'); return; }
    const qty = parseInt((document.getElementById('bodQty')?.value) || '0', 10);
    const costo = parseFloat((document.getElementById('bodCosto')?.value) || '0');
    if(!qty || qty <= 0){ alert('Cantidad inválida'); return; }
    const p = (state.products || []).find(x => x.sku === this.selectedSku);
    if(!p){ alert('Producto no encontrado'); return; }
    this.lote.push({ sku:p.sku, nombre:p.nombre, qty, costo });
    this.selectedSku = ''; this.renderLote();
    const s = document.getElementById('bodSearch'); if(s) s.value = '';
    const q = document.getElementById('bodQty'); if(q) q.value = 1;
    const c = document.getElementById('bodCosto'); if(c) c.value = '';
  },
  renderLote(){
    const rows = this.lote.map((i,idx) => `<tr><td>${esc(i.sku)}</td><td>${esc(i.nombre)}</td><td>${i.qty}</td><td>${money(i.costo || 0)}</td><td><button class="btn small danger" onclick="Bodega.delItem(${idx})">🗑️</button></td></tr>`).join('');
    const tbl = document.getElementById('bodLote');
    if(tbl) tbl.innerHTML = `<table><thead><tr><th>SKU</th><th>Producto</th><th>Cantidad</th><th>Costo unitario</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="5">Sin items</td></tr>'}</tbody></table>`;
  },
  delItem(idx){ this.lote.splice(idx,1); this.renderLote(); },
  confirmarEntrada(){
    if(this.lote.length === 0){ alert('Agrega productos al lote.'); return; }
    const proveedor = document.getElementById('bodProveedor')?.value || '';
    const fecha = ((document.getElementById('bodFecha')?.value) || new Date().toISOString().slice(0,10)) + 'T00:00:00';
    const notas = document.getElementById('bodNotas')?.value || '';
    const folio = 'E' + Date.now().toString().slice(-8);
    state.bodegaStock = state.bodegaStock || {}; state.movimientosBodega = state.movimientosBodega || [];
    this.lote.forEach(i => {
      const cur = state.bodegaStock[i.sku] || { qty:0, costoProm:0 };
      const newQty = cur.qty + i.qty;
      const newCosto = (i.costo && i.costo > 0) ? ((cur.qty * cur.costoProm + i.qty * i.costo) / Math.max(1, newQty)) : cur.costoProm;
      state.bodegaStock[i.sku] = { qty:newQty, costoProm: parseFloat((newCosto || 0).toFixed(2)) };
      state.movimientosBodega.unshift({ folio, fecha, tipo:'entrada', sku:i.sku, nombre:i.nombre, qty:i.qty, costo:i.costo || 0, proveedor, notas });
    });
    DB.save(state);
    this.lote = []; this.renderLote(); this.renderStock(); this.renderMovs(); Dashboard.render();
    alert('Entrada registrada en Bodega.');
  },
  renderStock(){
    const tbl = document.getElementById('bodStockTabla'); if(!tbl) return;
    const rows = Object.entries(state.bodegaStock || {}).map(([sku,info]) => {
      const p = (state.products || []).find(x => x.sku === sku) || { nombre: sku };
      return `<tr><td>${esc(sku)}</td><td>${esc(p.nombre)}</td><td>${info.qty}</td><td>${money(info.costoProm || 0)}</td><td><button class="btn small" onclick="Bodega.openTransfer('${sku}')">🔄 Transferir</button></td></tr>`;
    }).join('');
    tbl.innerHTML = `<table><thead><tr><th>SKU</th><th>Producto</th><th>En bodega</th><th>Costo prom. bodega</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="5">Sin stock en bodega</td></tr>'}</tbody></table>`;
  },
  openTransfer(sku){
    this._transferSku = sku;
    const m = document.getElementById('modalTransfer'); if(!m) return;
    const info = (state.bodegaStock || {})[sku] || { qty:0, costoProm:0 };
    const p = (state.products || []).find(x => x.sku === sku) || { nombre: sku };
    document.getElementById('trSku').value = sku;
    document.getElementById('trNombre').value = p.nombre;
    document.getElementById('trEnBodega').value = info.qty;
    document.getElementById('trQty').value = '';
    document.getElementById('trUpdCosto').checked = false;
    document.getElementById('trNotas').value = '';
    m.classList.remove('hidden'); m.setAttribute('aria-hidden','false');
  },
  closeTransfer(){ const m = document.getElementById('modalTransfer'); if(m){ m.classList.add('hidden'); m.setAttribute('aria-hidden','true'); } this._transferSku = null; },
  confirmTransfer(){
    const sku = this._transferSku; if(!sku) return;
    const qty = parseInt(document.getElementById('trQty').value || '0', 10);
    const upd = document.getElementById('trUpdCosto').checked;
    const notas = document.getElementById('trNotas').value || '';
    const info = (state.bodegaStock || {})[sku] || { qty:0, costoProm:0 };
    if(!qty || qty <= 0){ alert('Cantidad inválida'); return; }
    if(qty > info.qty){ alert('No hay suficientes piezas en bodega.'); return; }
    info.qty -= qty; state.bodegaStock[sku] = info;
    const p = (state.products || []).find(x => x.sku === sku);
    if(!p){ alert('Producto inexistente en catálogo.'); return; }
    p.stock = (p.stock || 0) + qty; if(upd){ p.costo = info.costoProm || p.costo || 0; }
    const folio = 'S' + Date.now().toString().slice(-8);
    const fecha = new Date().toISOString();
    state.movimientosBodega.unshift({ folio, fecha, tipo:'salida', sku, nombre:p.nombre, qty, costo:info.costoProm || 0, destino:'inventario', notas });
    DB.save(state);
    this.renderStock(); this.renderMovs(); Inventario.renderTabla(); Dashboard.render(); this.closeTransfer();
    alert('Transferencia realizada.');
  },
  renderMovs(){
    const wrap = document.getElementById('bodTabla'); if(!wrap) return;
    const ini = document.getElementById('bodIni')?.value || '0000-01-01';
    const fin = document.getElementById('bodFin')?.value || '9999-12-31';
    const rows = (state.movimientosBodega || [])
      .filter(m => { const f = (m.fecha || '').slice(0,10); return f >= ini && f <= fin; })
      .map(m => `<tr><td>${esc(m.folio || '')}</td><td>${(m.fecha || '').slice(0,10)}</td><td>${esc(m.tipo)}</td><td>${esc(m.sku)}</td><td>${esc(m.nombre || '')}</td><td>${m.qty || 0}</td><td>${money(m.costo || 0)}</td><td>${esc(m.proveedor || m.destino || '')}</td><td>${esc(m.notas || '')}</td></tr>`).join('');
    wrap.innerHTML = `<table><thead><tr><th>Folio</th><th>Fecha</th><th>Tipo</th><th>SKU</th><th>Producto</th><th>Qty</th><th>Costo</th><th>Proveedor/Destino</th><th>Notas</th></tr></thead><tbody>${rows || '<tr><td colspan="9">Sin movimientos</td></tr>'}</tbody></table>`;
  },
  exportCSV(){
    const rows = [['Folio','Fecha','Tipo','SKU','Producto','Qty','Costo','Proveedor/Destino','Notas']]
      .concat((state.movimientosBodega || []).map(m => [m.folio || '', m.fecha || '', m.tipo || '', m.sku || '', m.nombre || '', m.qty || 0, m.costo || 0, (m.proveedor || m.destino || ''), m.notas || '']));
    downloadCSV('bodega_movimientos.csv', rows);
  }
};

/* ---------- Ventas ---------- */
const Ventas = {
  cart: [],
  buscarProducto(term){
    term = (term || '').toLowerCase();
    const res = (state.products || [])
      .filter(p => p.nombre.toLowerCase().includes(term) || (p.sku || '').toLowerCase().includes(term))
      .slice(0, 50);
    const wrap = document.getElementById('venResultados'); if(!wrap) return;
    wrap.innerHTML = '';
    res.forEach(p => {
      const div = document.createElement('div'); div.className = 'list-item';
      div.innerHTML = `<div style="flex:1">
        <div><strong>${esc(p.nombre)}</strong></div>
        <div class="sub">SKU: ${esc(p.sku)} • Precio: ${money(p.precio || 0)} • Stock: ${p.stock || 0}</div>
      </div>
      <div><button class="btn small">Agregar</button></div>`;
      div.querySelector('button').onclick = () => this.agregar(p.sku);
      wrap.appendChild(div);
    });
  },
  agregar(sku){
    const p = (state.products || []).find(x => x.sku === sku);
    if(!p){ alert('Producto no encontrado'); return; }
    const item = this.cart.find(i => i.sku === sku);
    if(item){ item.qty += 1; }
    else { this.cart.push({ sku:p.sku, nombre:p.nombre, precio:p.precio || 0, qty:1 }); }
    this.renderCarrito();
  },
  cambiarQty(idx, qty){
    qty = parseInt(qty||'0',10);
    if(qty <= 0){ this.cart.splice(idx,1); } else { this.cart[idx].qty = qty; }
    this.renderCarrito();
  },
  quitar(idx){ this.cart.splice(idx,1); this.renderCarrito(); },
  total(){ return this.cart.reduce((a,i)=> a + i.qty * (i.precio || 0), 0); },
  renderCarrito(){
    const el = document.getElementById('venCarrito'); if(!el) return;
    const rows = this.cart.map((i,idx)=>`
      <tr>
        <td>${esc(i.sku)}</td>
        <td>${esc(i.nombre)}</td>
        <td><input type="number" min="1" value="${i.qty}" onchange="Ventas.cambiarQty(${idx}, this.value)" style="width:80px"></td>
        <td>${money(i.precio || 0)}</td>
        <td>${money(i.qty * (i.precio || 0))}</td>
        <td><button class="btn small danger" onclick="Ventas.quitar(${idx})">🗑️</button></td>
      </tr>`).join('');
    el.innerHTML = `<table>
      <thead><tr><th>SKU</th><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">Sin productos</td></tr>'}</tbody>
    </table>`;
    const tot = document.getElementById('venTotal'); if(tot) tot.value = money(this.total());
  },
  cobrar(){
    if(this.cart.length === 0){ alert('Carrito vacío'); return; }
    for(const i of this.cart){
      const p = state.products.find(x=>x.sku===i.sku);
      if((p.stock||0) < i.qty){ alert(`Stock insuficiente para ${p.nombre}`); return; }
    }
    this.cart.forEach(i => {
      const p = state.products.find(x=>x.sku===i.sku);
      p.stock = (p.stock||0) - i.qty;
    });
    const venta = {
      folio: 'V' + Date.now().toString().slice(-8),
      fecha: new Date().toISOString(),
      cliente: (document.getElementById('venCliente')?.value || 'Público General'),
      pago: (document.getElementById('venPago')?.value || 'efectivo'),
      items: JSON.parse(JSON.stringify(this.cart)),
      total: this.total()
    };
    state.sales.unshift(venta);
    DB.save(state);
    this.renderTicket(venta);
    Inventario.renderTabla();
    Dashboard.render();
    const solo = document.getElementById('ticketAreaSolo'); if(solo) solo.innerHTML = document.getElementById('ticketArea').innerHTML;
    this.cart = []; this.renderCarrito();
    alert('Venta registrada.');
  },
  renderTicket(v){
    const el = document.getElementById('ticketArea'); if(!el) return;
    const items = (v.items||[]).map(i=>`
      <tr><td>${esc(i.nombre)}</td><td>${i.qty}</td><td>${money(i.precio)}</td><td>${money(i.qty*i.precio)}</td></tr>
    `).join('');
    el.innerHTML = `<table>
      <thead><tr><th colspan="4">DINÁMITA POS v4.8 — Ticket ${esc(v.folio)}</th></tr>
        <tr><th>Producto</th><th>Qty</th><th>Precio</th><th>Importe</th></tr></thead>
      <tbody>${items}</tbody>
      <tfoot><tr><th colspan="3" style="text-align:right">Total</th><th>${money(v.total)}</th></tr>
      <tr><td colspan="4">Cliente: ${esc(v.cliente)} — Pago: ${esc(v.pago)} — Fecha: ${(v.fecha||'').slice(0,19).replace('T',' ')}</td></tr></tfoot>
    </table>`;
  }
};

document.addEventListener('DOMContentLoaded', UI.init);
