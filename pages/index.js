import { useEffect, useRef, useState, useCallback } from 'react';
import Head from 'next/head';

const POLL_MS = 3000;

function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'agora mesmo';
  if (diff < 3600) return Math.floor(diff / 60) + ' min atrás';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h atrás';
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fullDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function statusInfo(s) {
  if (s === 'pendente') return { cls: 'status-pendente', txt: 'Pendente' };
  if (s === 'separando') return { cls: 'status-separando', txt: 'Em separação' };
  if (s === 'cancelada') return { cls: 'status-cancelada', txt: 'Cancelada' };
  return { cls: 'status-concluida', txt: 'Concluída' };
}

async function api(path, opts) {
  const res = await fetch(path, {
    method: opts?.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: opts?.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro ao comunicar com o servidor');
  return data;
}

export default function Home() {
  const [role, setRole] = useState('home'); // home | encarregado | repositor
  const [config, setConfig] = useState({ setores: [], encarregados: [], repositores: [], produtos: {} });
  const [comandas, setComandas] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef(null);

  const [encarregadoAtual, setEncarregadoAtual] = useState(null);
  const [repositorAtual, setRepositorAtual] = useState(null);

  const [currentSetor, setCurrentSetor] = useState('');
  const [selectedProducts, setSelectedProducts] = useState({}); // nome -> {checked, qtd}
  const [obs, setObs] = useState('');
  const [newSetor, setNewSetor] = useState('');
  const [newProduct, setNewProduct] = useState('');
  const [newEncarregado, setNewEncarregado] = useState('');
  const [newRepositor, setNewRepositor] = useState('');
  const [sending, setSending] = useState(false);

  const [repTab, setRepTab] = useState('pendentes');
  const [detailId, setDetailId] = useState(null);

  useEffect(() => {
    setEncarregadoAtual(localStorage.getItem('cr_encarregado'));
    setRepositorAtual(localStorage.getItem('cr_repositor'));
  }, []);

  function toast(msg) {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2800);
  }

  const refresh = useCallback(async () => {
    try {
      const [cfg, list] = await Promise.all([api('/api/config'), api('/api/comandas')]);
      setConfig(cfg);
      setComandas(list);
      setLoadError(false);
      setCurrentSetor(prev => (prev && cfg.setores.includes(prev)) ? prev : (cfg.setores[0] || ''));
    } catch (e) {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  // ---------- ENCARREGADO ----------
  function loginEncarregado(nome) {
    localStorage.setItem('cr_encarregado', nome);
    setEncarregadoAtual(nome);
  }
  function logout() {
    localStorage.removeItem('cr_encarregado');
    localStorage.removeItem('cr_repositor');
    setEncarregadoAtual(null);
    setRepositorAtual(null);
    setRole('home');
  }
  async function addEncarregado() {
    const val = newEncarregado.trim();
    if (!val) return;
    try {
      const cfg = await api('/api/config', { method: 'PATCH', body: { type: 'addEncarregado', nome: val } });
      setConfig(cfg);
      setNewEncarregado('');
      toast('Encarregado adicionado');
    } catch (e) { toast(e.message); }
  }
  async function addSetor() {
    const val = newSetor.trim();
    if (!val) return;
    try {
      const cfg = await api('/api/config', { method: 'PATCH', body: { type: 'addSetor', nome: val } });
      setConfig(cfg);
      setCurrentSetor(val);
      setNewSetor('');
      toast('Setor "' + val + '" adicionado e salvo');
    } catch (e) { toast(e.message); }
  }
  async function addProduct() {
    const val = newProduct.trim();
    if (!val || !currentSetor) return;
    try {
      const cfg = await api('/api/config', { method: 'PATCH', body: { type: 'addProduto', setor: currentSetor, nome: val } });
      setConfig(cfg);
      setSelectedProducts(prev => ({ ...prev, [val]: { checked: true, qtd: 1 } }));
      setNewProduct('');
      toast('Produto adicionado à lista do setor e já marcado');
    } catch (e) { toast(e.message); }
  }
  function toggleProduct(nome, checked) {
    setSelectedProducts(prev => ({ ...prev, [nome]: { checked, qtd: prev[nome]?.qtd || 1 } }));
  }
  function setProductQtd(nome, qtd) {
    setSelectedProducts(prev => ({ ...prev, [nome]: { checked: prev[nome]?.checked || false, qtd: Number(qtd) || 1 } }));
  }
  async function enviarComanda() {
    const itens = Object.keys(selectedProducts)
      .filter(n => selectedProducts[n].checked)
      .map(n => ({ nome: n, qtd: selectedProducts[n].qtd || 1 }));
    if (itens.length === 0) { toast('Selecione ao menos um produto em falta'); return; }
    if (!currentSetor) { toast('Selecione o setor'); return; }
    setSending(true);
    try {
      await api('/api/comandas', { method: 'POST', body: { encarregado: encarregadoAtual, setor: currentSetor, itens, observacao: obs.trim() } });
      setSelectedProducts({});
      setObs('');
      toast('Requisição enviada para os repositores ✅');
      refresh();
    } catch (e) { toast(e.message); }
    setSending(false);
  }
  async function cancelarComanda(id) {
    try {
      await api('/api/comandas/' + id, { method: 'PATCH', body: { action: 'cancelar' } });
      toast('Requisição cancelada');
      refresh();
    } catch (e) { toast(e.message); }
  }

  // ---------- REPOSITOR ----------
  function loginRepositor(nome) {
    localStorage.setItem('cr_repositor', nome);
    setRepositorAtual(nome);
  }
  async function addRepositor() {
    const val = newRepositor.trim();
    if (!val) return;
    try {
      const cfg = await api('/api/config', { method: 'PATCH', body: { type: 'addRepositor', nome: val } });
      setConfig(cfg);
      loginRepositor(val);
      setNewRepositor('');
      toast('Repositor cadastrado');
    } catch (e) { toast(e.message); }
  }
  async function pegarComanda(id) {
    try {
      await api('/api/comandas/' + id, { method: 'PATCH', body: { action: 'pegar', repositor: repositorAtual } });
      toast('Comanda atribuída a você');
      setRepTab('minhas');
      refresh();
    } catch (e) { toast(e.message); refresh(); }
  }
  async function toggleItem(comandaId, itemIndex, separado) {
    setComandas(prev => prev.map(c => c.id === comandaId
      ? { ...c, itens: c.itens.map((it, i) => i === itemIndex ? { ...it, separado } : it) }
      : c));
    try {
      await api('/api/comandas/' + comandaId, { method: 'PATCH', body: { action: 'toggleItem', itemIndex, separado } });
    } catch (e) { toast(e.message); refresh(); }
  }
  async function concluirComanda(id) {
    try {
      await api('/api/comandas/' + id, { method: 'PATCH', body: { action: 'concluir' } });
      toast('Comanda concluída! Produtos descendo para a loja.');
      refresh();
    } catch (e) { toast(e.message); }
  }

  // ---------- RENDER HELPERS ----------
  const encComandas = comandas.filter(c => c.encarregado === encarregadoAtual);
  const pendentes = comandas.filter(c => c.status === 'pendente');
  const minhas = comandas.filter(c => c.status === 'separando' && c.repositor === repositorAtual);
  const historicoRep = comandas.filter(c => (c.status === 'concluida' || c.status === 'cancelada') && c.repositor === repositorAtual);
  const detailComanda = comandas.find(c => c.id === detailId);

  return (
    <div className="app">
      <Head>
        <title>Central de Reposição</title>
        <link rel="icon" href="data:image/x-icon;," />
      </Head>

      {loadError && <div className="error-banner">Não foi possível conectar ao banco de dados. Verifique se o KV foi configurado no Vercel.</div>}

      {role !== 'home' && (
        <div className="topbar">
          <img src="/logo.png" alt="logo" />
          <div className="titles">
            <b>Central de Reposição</b>
            <span>
              {role === 'encarregado'
                ? (encarregadoAtual ? 'Painel do Encarregado · ' + encarregadoAtual : 'Identifique-se')
                : (repositorAtual ? 'Painel do Repositor · ' + repositorAtual : 'Login')}
            </span>
          </div>
          <div className="spacer" />
          <span className={'pill ' + (role === 'encarregado' ? 'blue' : 'red')}>
            {role === 'encarregado' ? 'Encarregado' : 'Repositor'}
          </span>
          {((role === 'encarregado' && encarregadoAtual) || (role === 'repositor' && repositorAtual)) && (
            <button className="btn-logout" onClick={logout}>Sair</button>
          )}
        </div>
      )}

      <main>
        {role === 'home' && (
          <section className="home">
            <img className="logo" src="/logo.png" alt="logo" />
            <div>
              <h1>Central de Reposição</h1>
              <p>Encarregados enviam pedidos de mercadoria faltante direto para os repositores.</p>
            </div>
            <div className="role-grid">
              <button className="role-card blue" onClick={() => setRole('encarregado')}>
                <div className="icon">🧑‍💼</div>
                <b>Sou Encarregado</b>
                <span>Enviar requisição de setor</span>
              </button>
              <button className="role-card red" onClick={() => setRole('repositor')}>
                <div className="icon">📦</div>
                <b>Sou Repositor</b>
                <span>Ver e separar comandas</span>
              </button>
            </div>
          </section>
        )}

        {role === 'encarregado' && !encarregadoAtual && (
          <div className="login-box">
            <div className="icon">🧑‍💼</div>
            <h2 style={{ margin: '8px 0 2px' }}>Quem é você?</h2>
            <p className="muted">Selecione seu nome para continuar</p>
            <div className="name-grid">
              {config.encarregados.map(n => (
                <button key={n} className="name-btn" onClick={() => loginEncarregado(n)}>{n} <span>→</span></button>
              ))}
            </div>
            <div className="add-inline">
              <input type="text" placeholder="Adicionar novo encarregado…" value={newEncarregado}
                onChange={e => setNewEncarregado(e.target.value)} onKeyDown={e => e.key === 'Enter' && addEncarregado()} />
              <button className="btn btn-primary-blue" onClick={addEncarregado}>Adicionar</button>
            </div>
            <button className="btn btn-ghost" onClick={() => setRole('home')}>← Voltar</button>
          </div>
        )}

        {role === 'encarregado' && encarregadoAtual && (
          <>
            <div className="section">
              <div className="section-title">Nova requisição</div>
              <div className="card">
                <label className="field-label">Setor</label>
                <select value={currentSetor} onChange={e => { setCurrentSetor(e.target.value); setSelectedProducts({}); }}>
                  {config.setores.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="add-inline">
                  <input type="text" placeholder="Adicionar novo setor…" value={newSetor}
                    onChange={e => setNewSetor(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSetor()} />
                  <button className="btn btn-outline" onClick={addSetor}>+ Setor</button>
                </div>

                <label className="field-label">Produtos em falta</label>
                <div className="product-list">
                  {(config.produtos[currentSetor] || []).length === 0 && (
                    <div className="empty-hint">Nenhum produto cadastrado neste setor ainda. Adicione abaixo.</div>
                  )}
                  {(config.produtos[currentSetor] || []).map(p => {
                    const st = selectedProducts[p] || { checked: false, qtd: 1 };
                    return (
                      <div className="product-row" key={p}>
                        <input type="checkbox" checked={st.checked} onChange={e => toggleProduct(p, e.target.checked)} />
                        <span className="pname">{p}</span>
                        {st.checked && <input type="number" min="1" value={st.qtd} onChange={e => setProductQtd(p, e.target.value)} />}
                      </div>
                    );
                  })}
                </div>
                <div className="add-inline">
                  <input type="text" placeholder="Adicionar produto que não está na lista…" value={newProduct}
                    onChange={e => setNewProduct(e.target.value)} onKeyDown={e => e.key === 'Enter' && addProduct()} />
                  <button className="btn btn-outline" onClick={addProduct}>+ Produto</button>
                </div>

                <label className="field-label">Observação (opcional)</label>
                <textarea placeholder="Ex: precisa com urgência, cliente aguardando…" value={obs} onChange={e => setObs(e.target.value)} />

                <button className="btn btn-primary-blue btn-block" disabled={sending} onClick={enviarComanda}>
                  {sending ? 'Enviando…' : 'Enviar requisição para os repositores'}
                </button>
              </div>
            </div>

            <div className="section">
              <div className="section-title">Histórico de requisições enviadas</div>
              {encComandas.length === 0 && (
                <div className="empty-state"><div className="big">📭</div>Nenhuma requisição enviada ainda</div>
              )}
              {encComandas.map(c => {
                const st = statusInfo(c.status);
                const doneCount = (c.itens || []).filter(i => i.separado).length;
                return (
                  <div className="comanda-card" key={c.id} onClick={() => setDetailId(c.id)}>
                    <div className="comanda-head">
                      <div>
                        <div className="setor">{c.setor}</div>
                        <div className="meta">{(c.itens || []).length} produto(s) · {timeAgo(c.criadoEm)}{c.repositor ? ' · Repositor: ' + c.repositor : ''}</div>
                      </div>
                      <span className={'status-badge ' + st.cls}>{st.txt}</span>
                    </div>
                    {c.observacao && <div className="muted" style={{ marginTop: 8 }}>📝 {c.observacao}</div>}
                    <div className="progress-track"><div className="progress-fill" style={{ width: ((c.itens?.length ? doneCount / c.itens.length * 100 : 0)) + '%', background: 'var(--blue-800)' }} /></div>
                    {c.status === 'pendente' && (
                      <div className="comanda-actions">
                        <button className="btn btn-outline" onClick={e => { e.stopPropagation(); cancelarComanda(c.id); }}>Cancelar requisição</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {role === 'repositor' && !repositorAtual && (
          <div className="login-box">
            <div className="icon">📦</div>
            <h2 style={{ margin: '8px 0 2px' }}>Login do repositor</h2>
            <p className="muted">Selecione seu nome de usuário</p>
            <div className="name-grid">
              {config.repositores.length === 0 && <div className="empty-hint">Nenhum repositor cadastrado. Adicione seu nome abaixo.</div>}
              {config.repositores.map(n => (
                <button key={n} className="name-btn" onClick={() => loginRepositor(n)}>{n} <span>→</span></button>
              ))}
            </div>
            <div className="add-inline">
              <input type="text" placeholder="Cadastrar novo repositor…" value={newRepositor}
                onChange={e => setNewRepositor(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRepositor()} />
              <button className="btn btn-primary-red" onClick={addRepositor}>Adicionar</button>
            </div>
            <button className="btn btn-ghost" onClick={() => setRole('home')}>← Voltar</button>
          </div>
        )}

        {role === 'repositor' && repositorAtual && (
          <>
            <div className="tabs">
              <div className={'tab red-active' + (repTab === 'pendentes' ? ' active' : '')} onClick={() => setRepTab('pendentes')}>
                Pendentes {pendentes.length > 0 && <span className="count">({pendentes.length})</span>}
              </div>
              <div className={'tab red-active' + (repTab === 'minhas' ? ' active' : '')} onClick={() => setRepTab('minhas')}>
                Em separação {minhas.length > 0 && <span className="count">({minhas.length})</span>}
              </div>
              <div className={'tab red-active' + (repTab === 'historico' ? ' active' : '')} onClick={() => setRepTab('historico')}>
                Histórico
              </div>
            </div>

            {repTab === 'pendentes' && (
              pendentes.length === 0
                ? <div className="empty-state"><div className="big">🎉</div>Nenhuma comanda pendente no momento</div>
                : pendentes.map(c => (
                  <div className="comanda-card" key={c.id} onClick={() => setDetailId(c.id)}>
                    <div className="comanda-head">
                      <div>
                        <div className="setor">{c.setor}</div>
                        <div className="meta">Encarregado: {c.encarregado} · {(c.itens || []).length} produto(s) · {timeAgo(c.criadoEm)}</div>
                      </div>
                      <span className="status-badge status-pendente">Pendente</span>
                    </div>
                    {c.observacao && <div className="muted" style={{ marginTop: 8 }}>📝 {c.observacao}</div>}
                    <div className="comanda-actions">
                      <button className="btn btn-primary-red" onClick={e => { e.stopPropagation(); pegarComanda(c.id); }}>Pegar comanda</button>
                    </div>
                  </div>
                ))
            )}

            {repTab === 'minhas' && (
              minhas.length === 0
                ? <div className="empty-state"><div className="big">🧾</div>Você não tem comandas em separação</div>
                : minhas.map(c => {
                  const total = (c.itens || []).length;
                  const doneCount = (c.itens || []).filter(i => i.separado).length;
                  const allDone = total > 0 && doneCount === total;
                  return (
                    <div className="comanda-card" key={c.id} style={{ cursor: 'default' }}>
                      <div className="comanda-head">
                        <div>
                          <div className="setor">{c.setor}</div>
                          <div className="meta">Encarregado: {c.encarregado} · {timeAgo(c.criadoEm)}</div>
                        </div>
                        <span className="status-badge status-separando">Em separação</span>
                      </div>
                      {c.observacao && <div className="muted" style={{ marginTop: 8 }}>📝 {c.observacao}</div>}
                      <div className="progress-track"><div className="progress-fill" style={{ width: (total ? doneCount / total * 100 : 0) + '%' }} /></div>
                      <div>
                        {(c.itens || []).map((it, idx) => (
                          <div className="item-line" key={idx}>
                            <input type="checkbox" checked={!!it.separado} onChange={e => toggleItem(c.id, idx, e.target.checked)} />
                            <span className={'iname' + (it.separado ? ' done' : '')}>{it.nome}</span>
                            <span className="qtd">qtd {it.qtd || 1}</span>
                          </div>
                        ))}
                      </div>
                      <div className="comanda-actions">
                        <button className="btn btn-primary-red" disabled={!allDone} onClick={() => concluirComanda(c.id)}>Concluir comanda</button>
                      </div>
                    </div>
                  );
                })
            )}

            {repTab === 'historico' && (
              historicoRep.length === 0
                ? <div className="empty-state"><div className="big">📚</div>Nenhuma comanda no seu histórico ainda</div>
                : historicoRep.map(c => {
                  const st = statusInfo(c.status);
                  return (
                    <div className="comanda-card" key={c.id} onClick={() => setDetailId(c.id)}>
                      <div className="comanda-head">
                        <div>
                          <div className="setor">{c.setor}</div>
                          <div className="meta">Encarregado: {c.encarregado} · {(c.itens || []).length} produto(s) · {timeAgo(c.atualizadoEm)}</div>
                        </div>
                        <span className={'status-badge ' + st.cls}>{st.txt}</span>
                      </div>
                    </div>
                  );
                })
            )}
          </>
        )}
      </main>

      {detailComanda && (
        <div className="modal-overlay" onClick={() => setDetailId(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDetailId(null)}>✕</button>
            <h2>{detailComanda.setor}</h2>
            <div className="muted">Encarregado: {detailComanda.encarregado}{detailComanda.repositor ? ' · Repositor: ' + detailComanda.repositor : ''}</div>
            <div style={{ marginTop: 10 }}>
              <span className={'status-badge ' + statusInfo(detailComanda.status).cls}>{statusInfo(detailComanda.status).txt}</span>
            </div>
            {detailComanda.observacao && <div className="muted" style={{ marginTop: 10 }}>📝 {detailComanda.observacao}</div>}

            <label className="field-label">Itens pedidos</label>
            <div>
              {(detailComanda.itens || []).map((it, idx) => (
                <div className="item-line" key={idx}>
                  <span style={{ fontSize: 16 }}>{it.separado ? '✅' : '⬜'}</span>
                  <span className={'iname' + (it.separado ? ' done' : '')}>{it.nome}</span>
                  <span className="qtd">qtd {it.qtd || 1}</span>
                </div>
              ))}
            </div>

            <div className="timeline">
              <label className="field-label" style={{ marginTop: 0 }}>Linha do tempo</label>
              {(detailComanda.historico || []).map((h, i) => (
                <div className="timeline-item" key={i}>
                  <span>{fullDate(h.em)}</span>
                  <span>
                    {h.evento === 'criada' && <><b>{h.por}</b> criou a requisição</>}
                    {h.evento === 'pegou' && <><b>{h.por}</b> assumiu a comanda</>}
                    {h.evento === 'concluida' && <><b>{h.por}</b> concluiu a comanda</>}
                    {h.evento === 'cancelada' && <><b>{h.por}</b> cancelou a requisição</>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className={'toast' + (toastMsg ? ' show' : '')}>{toastMsg}</div>
    </div>
  );
}
