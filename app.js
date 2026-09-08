(function(){
  const CATS = ['Café / materia prima','Empaque y etiquetas','Diseño / branding','Producción / maquila','Logística / distribución','Marketing / redes','Otros'];
  const PEOPLE = ['Nico','Mari','Stephi'];

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let state = { cotizaciones: [], proveedores: [], tab: 'cotizaciones', showQForm: false, showPForm: false, loaded: false, compareCat: null };

  const viewEl = document.getElementById('cc-view');
  const bannerEl = document.getElementById('cc-banner');

  function fmtMoney(n, moneda){
    const num = Number(n) || 0;
    if(moneda === 'USD'){
      return '$' + num.toLocaleString('en-US', {maximumFractionDigits:2}) + ' USD';
    }
    return '$' + num.toLocaleString('es-CO', {maximumFractionDigits:0}) + ' COP';
  }

  function fmtDate(d){
    if(!d) return '';
    const parts = d.split('-');
    if(parts.length!==3) return d;
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  function escapeHtml(s){
    if(s===undefined || s===null) return '';
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  async function loadData(){
    try{
      const [{data: cot, error: e1}, {data: prov, error: e2}] = await Promise.all([
        sb.from('cotizaciones').select('*').order('fecha', {ascending:false}),
        sb.from('proveedores').select('*').order('nombre', {ascending:true})
      ]);
      if(e1 || e2) throw (e1 || e2);
      state.cotizaciones = cot || [];
      state.proveedores = prov || [];
      state.loaded = true;
      bannerEl.textContent = 'Conectado — todo lo que agregue cualquiera del equipo se ve aquí al instante.';
    }catch(e){
      console.error(e);
      bannerEl.textContent = 'No se pudo conectar a la base de datos. Revisa que SUPABASE_URL y SUPABASE_ANON_KEY en config.js estén bien copiados.';
    }
    render();
  }

  function setTab(t){ state.tab = t; state.showQForm=false; state.showPForm=false; render(); }

  async function cycleEstado(id){
    const order = ['pendiente','aceptada','rechazada'];
    const item = state.cotizaciones.find(c=>c.id===id);
    if(!item) return;
    const nuevo = order[(order.indexOf(item.estado)+1)%order.length];
    item.estado = nuevo;
    render();
    const {error} = await sb.from('cotizaciones').update({estado: nuevo}).eq('id', id);
    if(error){ bannerEl.textContent = 'No se pudo guardar el cambio de estado. Intenta de nuevo.'; }
  }

  async function deleteQ(id){
    state.cotizaciones = state.cotizaciones.filter(c=>c.id!==id);
    render();
    const {error} = await sb.from('cotizaciones').delete().eq('id', id);
    if(error){ bannerEl.textContent = 'No se pudo eliminar. Intenta de nuevo.'; }
  }

  async function deleteP(id){
    state.proveedores = state.proveedores.filter(p=>p.id!==id);
    render();
    const {error} = await sb.from('proveedores').delete().eq('id', id);
    if(error){ bannerEl.textContent = 'No se pudo eliminar. Intenta de nuevo.'; }
  }

  function optionsHtml(list, selectedVal){
    return list.map(v => `<option value="${v}" ${v===selectedVal?'selected':''}>${v}</option>`).join('');
  }

  function providerOptionsHtml(){
    const names = state.proveedores.map(p=>p.nombre);
    return '<option value="">— Escribir nuevo abajo —</option>' + names.map(n=>`<option value="${n}">${n}</option>`).join('');
  }

  function render(){
    if(!state.loaded){ viewEl.innerHTML = '<div class="cc-empty">Cargando…</div>'; return; }
    document.querySelectorAll('.cc-tab').forEach(b=>{
      b.classList.toggle('active', b.dataset.tab === state.tab);
    });
    if(state.tab === 'cotizaciones') renderCotizaciones();
    else if(state.tab === 'proveedores') renderProveedores();
    else if(state.tab === 'comparar') renderComparar();
    else renderResumen();
  }

  function renderCotizaciones(){
    const sorted = state.cotizaciones;

    let formHtml = '';
    if(state.showQForm){
      formHtml = `
        <div class="cc-form">
          <div class="cc-form-grid">
            <div class="cc-field">
              <label>Proveedor existente</label>
              <select id="qf-provsel">${providerOptionsHtml()}</select>
            </div>
            <div class="cc-field">
              <label>O nombre de proveedor nuevo</label>
              <input type="text" id="qf-provnew" placeholder="Ej: Tostadora El Roble">
            </div>
            <div class="cc-field">
              <label>Categoría</label>
              <select id="qf-cat">${optionsHtml(CATS)}</select>
            </div>
            <div class="cc-field">
              <label>Producto / servicio</label>
              <input type="text" id="qf-producto" placeholder="Ej: Empaque valvulado 250g x 500u">
            </div>
            <div class="cc-field">
              <label>Precio</label>
              <input type="number" id="qf-precio" placeholder="0" min="0" step="any">
            </div>
            <div class="cc-field">
              <label>Moneda</label>
              <select id="qf-moneda"><option value="COP">COP</option><option value="USD">USD</option></select>
            </div>
            <div class="cc-field">
              <label>Fecha</label>
              <input type="date" id="qf-fecha">
            </div>
            <div class="cc-field">
              <label>Quién cotizó</label>
              <select id="qf-autor">${optionsHtml(PEOPLE)}</select>
            </div>
          </div>
          <div class="cc-form-grid full" style="margin-top:12px;">
            <div class="cc-field">
              <label>Notas (condiciones, tiempos de entrega, mínimos, etc.)</label>
              <textarea id="qf-notas" placeholder="Opcional"></textarea>
            </div>
          </div>
          <div class="cc-form-actions">
            <button class="cc-btn" id="qf-save">Guardar cotización</button>
            <button class="cc-btn secondary" id="qf-cancel">Cancelar</button>
          </div>
        </div>`;
    }

    const rowsHtml = sorted.length ? sorted.map(c => `
      <div class="cc-row">
        <div class="cc-row-bar" style="background:${c.estado==='aceptada'?'var(--good)':c.estado==='rechazada'?'var(--bad)':'var(--warn)'}"></div>
        <div class="cc-row-main">
          <div class="cc-row-top">
            <div class="cc-row-title">${escapeHtml(c.producto || '(sin descripción)')} — ${escapeHtml(c.proveedor||'—')}</div>
            <div class="cc-row-price">${fmtMoney(c.precio, c.moneda)}</div>
          </div>
          <div class="cc-row-meta">
            <span class="cc-badge">${escapeHtml(c.categoria)}</span>
            &nbsp;${fmtDate(c.fecha)}${c.autor?(' · cotizó '+escapeHtml(c.autor)):''}
          </div>
          ${c.notas ? `<div class="cc-row-notes">${escapeHtml(c.notas)}</div>` : ''}
          <div class="cc-row-actions">
            <button class="cc-pill ${c.estado}" data-cycle="${c.id}">${c.estado}</button>
            <button class="cc-link-del" data-del="${c.id}">eliminar</button>
          </div>
        </div>
      </div>
    `).join('') : '<div class="cc-empty">Todavía no hay cotizaciones. Agrega la primera con el botón de arriba.</div>';

    viewEl.innerHTML = `
      <div class="cc-section-head">
        <h2>Cotizaciones (${state.cotizaciones.length})</h2>
        ${state.showQForm ? '' : '<button class="cc-btn" id="cc-add-q">+ Nueva cotización</button>'}
      </div>
      ${formHtml}
      <div>${rowsHtml}</div>
    `;

    document.getElementById('cc-add-q')?.addEventListener('click', ()=>{ state.showQForm = true; render(); });
    document.getElementById('qf-cancel')?.addEventListener('click', ()=>{ state.showQForm = false; render(); });
    document.getElementById('qf-save')?.addEventListener('click', async ()=>{
      const provSel = document.getElementById('qf-provsel').value;
      const provNew = document.getElementById('qf-provnew').value.trim();
      const proveedor = provNew || provSel;
      const producto = document.getElementById('qf-producto').value.trim();
      const precio = document.getElementById('qf-precio').value;
      if(!proveedor || !producto || !precio){
        alert('Por favor completa al menos proveedor, producto y precio.');
        return;
      }
      const categoria = document.getElementById('qf-cat').value;
      const nueva = {
        proveedor, categoria, producto,
        precio: Number(precio),
        moneda: document.getElementById('qf-moneda').value,
        fecha: document.getElementById('qf-fecha').value || new Date().toISOString().slice(0,10),
        autor: document.getElementById('qf-autor').value,
        notas: document.getElementById('qf-notas').value.trim(),
        estado: 'pendiente'
      };
      state.showQForm = false;
      const {error} = await sb.from('cotizaciones').insert(nueva);
      if(error){ bannerEl.textContent = 'No se pudo guardar la cotización. Intenta de nuevo.'; render(); return; }
      if(provNew && !state.proveedores.some(p=>p.nombre===provNew)){
        await sb.from('proveedores').insert({ nombre: provNew, categoria, contacto:'', notas:'' });
      }
      await loadData();
    });
    document.querySelectorAll('[data-cycle]').forEach(b=>{
      b.addEventListener('click', ()=> cycleEstado(b.dataset.cycle));
    });
    document.querySelectorAll('[data-del]').forEach(b=>{
      b.addEventListener('click', ()=> { if(confirm('¿Eliminar esta cotización?')) deleteQ(b.dataset.del); });
    });
  }

  function renderProveedores(){
    let formHtml = '';
    if(state.showPForm){
      formHtml = `
        <div class="cc-form">
          <div class="cc-form-grid">
            <div class="cc-field">
              <label>Nombre del proveedor</label>
              <input type="text" id="pf-nombre" placeholder="Ej: Finca La Esperanza">
            </div>
            <div class="cc-field">
              <label>Categoría principal</label>
              <select id="pf-cat">${optionsHtml(CATS)}</select>
            </div>
            <div class="cc-field">
              <label>Contacto (teléfono, email o Instagram)</label>
              <input type="text" id="pf-contacto" placeholder="Ej: 300 123 4567 / @finca">
            </div>
          </div>
          <div class="cc-form-grid full" style="margin-top:12px;">
            <div class="cc-field">
              <label>Notas</label>
              <textarea id="pf-notas" placeholder="Opcional: ubicación, mínimos de pedido, tiempos, referencias"></textarea>
            </div>
          </div>
          <div class="cc-form-actions">
            <button class="cc-btn" id="pf-save">Guardar proveedor</button>
            <button class="cc-btn secondary" id="pf-cancel">Cancelar</button>
          </div>
        </div>`;
    }

    const cardsHtml = state.proveedores.length ? state.proveedores.map(p=>{
      const nCot = state.cotizaciones.filter(c=>c.proveedor===p.nombre).length;
      return `
      <div class="cc-supplier-card">
        <div class="cc-supplier-top">
          <div class="cc-supplier-name">${escapeHtml(p.nombre)}</div>
          <span class="cc-badge">${escapeHtml(p.categoria||'Otros')}</span>
        </div>
        ${p.contacto ? `<div class="cc-supplier-contact">${escapeHtml(p.contacto)}</div>` : ''}
        ${p.notas ? `<div class="cc-supplier-notes">${escapeHtml(p.notas)}</div>` : ''}
        <div class="cc-row-actions">
          <span class="cc-badge">${nCot} cotización${nCot===1?'':'es'}</span>
          <button class="cc-link-del" data-delp="${p.id}">eliminar</button>
        </div>
      </div>`;
    }).join('') : '<div class="cc-empty">Todavía no hay proveedores registrados.</div>';

    viewEl.innerHTML = `
      <div class="cc-section-head">
        <h2>Proveedores (${state.proveedores.length})</h2>
        ${state.showPForm ? '' : '<button class="cc-btn" id="cc-add-p">+ Nuevo proveedor</button>'}
      </div>
      ${formHtml}
      <div>${cardsHtml}</div>
    `;

    document.getElementById('cc-add-p')?.addEventListener('click', ()=>{ state.showPForm = true; render(); });
    document.getElementById('pf-cancel')?.addEventListener('click', ()=>{ state.showPForm = false; render(); });
    document.getElementById('pf-save')?.addEventListener('click', async ()=>{
      const nombre = document.getElementById('pf-nombre').value.trim();
      if(!nombre){ alert('Ponle un nombre al proveedor.'); return; }
      const nuevo = {
        nombre,
        categoria: document.getElementById('pf-cat').value,
        contacto: document.getElementById('pf-contacto').value.trim(),
        notas: document.getElementById('pf-notas').value.trim()
      };
      state.showPForm = false;
      const {error} = await sb.from('proveedores').insert(nuevo);
      if(error){ bannerEl.textContent = 'No se pudo guardar el proveedor. Intenta de nuevo.'; render(); return; }
      await loadData();
    });
    document.querySelectorAll('[data-delp]').forEach(b=>{
      b.addEventListener('click', ()=> { if(confirm('¿Eliminar este proveedor?')) deleteP(b.dataset.delp); });
    });
  }

  function renderComparar(){
    const catsConDatos = CATS.filter(cat => state.cotizaciones.some(c=>c.categoria===cat));
    if(!state.compareCat || !catsConDatos.includes(state.compareCat)){
      state.compareCat = catsConDatos[0] || '';
    }

    if(!catsConDatos.length){
      viewEl.innerHTML = `
        <div class="cc-section-head"><h2>Comparar precios</h2></div>
        <div class="cc-empty">Todavía no hay cotizaciones para comparar. Agrega algunas en la pestaña "Cotizaciones".</div>`;
      return;
    }

    const items = state.cotizaciones.filter(c => c.categoria === state.compareCat);
    const enCOP = items.filter(c=>c.moneda==='COP').sort((a,b)=> Number(a.precio) - Number(b.precio));
    const enUSD = items.filter(c=>c.moneda==='USD').sort((a,b)=> Number(a.precio) - Number(b.precio));
    const minCOP = enCOP.length ? Number(enCOP[0].precio) : null;
    const minUSD = enUSD.length ? Number(enUSD[0].precio) : null;

    function rowsFor(list, minVal){
      return list.map((c,i) => `
        <div class="cc-compare-row ${Number(c.precio)===minVal ? 'best' : ''}">
          <div class="cc-compare-rank">${i+1}</div>
          <div class="cc-compare-mid">
            <div class="cc-compare-prov">${escapeHtml(c.proveedor)}</div>
            <div class="cc-compare-prod">${escapeHtml(c.producto)} · <span class="cc-pill ${c.estado}" style="cursor:default;">${c.estado}</span></div>
            ${Number(c.precio)===minVal ? '<div class="cc-best-tag">Mejor precio en esta categoría</div>' : ''}
          </div>
          <div class="cc-compare-price">${fmtMoney(c.precio, c.moneda)}</div>
        </div>
      `).join('');
    }

    viewEl.innerHTML = `
      <div class="cc-section-head"><h2>Comparar precios</h2></div>
      <div class="cc-field cc-compare-picker">
        <label>Categoría</label>
        <select id="cmp-cat">${optionsHtml(catsConDatos, state.compareCat)}</select>
      </div>
      <div class="cc-compare-note">Ordenado del más barato al más caro dentro de "${escapeHtml(state.compareCat)}". El precio más bajo no siempre es el mejor negocio — revisa las notas de cada cotización (calidad, tiempos de entrega, mínimos) antes de decidir.</div>
      ${enCOP.length ? `<h3 style="font-size:14px; margin-bottom:8px;">En pesos (COP)</h3>${rowsFor(enCOP, minCOP)}` : ''}
      ${enUSD.length ? `<h3 style="font-size:14px; margin:16px 0 8px;">En dólares (USD)</h3>${rowsFor(enUSD, minUSD)}` : ''}
    `;

    document.getElementById('cmp-cat').addEventListener('change', (e)=>{
      state.compareCat = e.target.value;
      render();
    });
  }

  function renderResumen(){
    const total = state.cotizaciones.length;
    const aceptadas = state.cotizaciones.filter(c=>c.estado==='aceptada');
    const pendientes = state.cotizaciones.filter(c=>c.estado==='pendiente');

    const totalCOP = aceptadas.filter(c=>c.moneda==='COP').reduce((s,c)=>s+Number(c.precio||0),0);
    const totalUSD = aceptadas.filter(c=>c.moneda==='USD').reduce((s,c)=>s+Number(c.precio||0),0);

    const byCat = {};
    CATS.forEach(cat => byCat[cat] = { count: 0, copSum: 0 });
    state.cotizaciones.forEach(c=>{
      if(!byCat[c.categoria]) byCat[c.categoria] = { count: 0, copSum: 0 };
      byCat[c.categoria].count += 1;
      if(c.moneda === 'COP') byCat[c.categoria].copSum += Number(c.precio||0);
    });
    const maxCopSum = Math.max(1, ...Object.values(byCat).map(v=>v.copSum));

    const catRowsHtml = Object.entries(byCat).filter(([,v])=>v.count>0).map(([cat,v])=>`
      <div class="cc-cat-row">
        <div class="cc-cat-top">
          <span class="cc-cat-name">${escapeHtml(cat)}</span>
          <span>${v.count} cotización${v.count===1?'':'es'}${v.copSum? ' · '+fmtMoney(v.copSum,'COP'):''}</span>
        </div>
        <div class="cc-cat-track"><div class="cc-cat-fill" style="width:${Math.round((v.copSum/maxCopSum)*100)}%"></div></div>
      </div>
    `).join('');

    viewEl.innerHTML = `
      <div class="cc-section-head"><h2>Resumen de costos</h2></div>
      <div class="cc-stats">
        <div class="cc-stat"><div class="num">${total}</div><div class="label">Cotizaciones registradas</div></div>
        <div class="cc-stat"><div class="num">${state.proveedores.length}</div><div class="label">Proveedores</div></div>
        <div class="cc-stat"><div class="num">${pendientes.length}</div><div class="label">Pendientes por decidir</div></div>
      </div>

      <h3 style="font-size:16px; margin-bottom:10px;">Costo estimado (solo cotizaciones aceptadas)</h3>
      <div class="cc-stats" style="grid-template-columns: 1fr 1fr;">
        <div class="cc-stat"><div class="num">${fmtMoney(totalCOP,'COP')}</div><div class="label">Total en pesos colombianos</div></div>
        <div class="cc-stat"><div class="num">${fmtMoney(totalUSD,'USD')}</div><div class="label">Total en dólares</div></div>
      </div>

      <h3 style="font-size:16px; margin-bottom:10px;">Cotizaciones por categoría</h3>
      ${catRowsHtml || '<div class="cc-empty">Aún no hay cotizaciones para resumir.</div>'}
    `;
  }

  document.querySelectorAll('.cc-tab').forEach(b=>{
    b.addEventListener('click', ()=> setTab(b.dataset.tab));
  });

  // Tiempo real: si Mari o Stephi agregan/cambian algo, se actualiza solo
  sb.channel('cc-changes')
    .on('postgres_changes', {event:'*', schema:'public', table:'cotizaciones'}, () => loadData())
    .on('postgres_changes', {event:'*', schema:'public', table:'proveedores'}, () => loadData())
    .subscribe();

  loadData();
})();
