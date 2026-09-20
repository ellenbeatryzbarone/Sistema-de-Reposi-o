import { getComandas, saveComandas } from '../../../lib/kv';

export default async function handler(req, res) {
  try {
    const { id } = req.query;
    const list = await getComandas();
    const idx = list.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Requisição não encontrada' });

    if (req.method === 'PATCH') {
      const c = list[idx];
      const { action, repositor, itemIndex, separado } = req.body || {};
      const now = new Date().toISOString();
      c.historico = c.historico || [];

      if (action === 'pegar') {
        if (c.status !== 'pendente') {
          return res.status(409).json({ error: 'Essa comanda já foi pega por outro repositor' });
        }
        if (!repositor) return res.status(400).json({ error: 'Repositor não informado' });
        c.status = 'separando';
        c.repositor = repositor;
        c.atualizadoEm = now;
        c.historico.push({ evento: 'pegou', em: now, por: repositor });
      } else if (action === 'toggleItem') {
        if (c.status !== 'separando') return res.status(409).json({ error: 'Comanda não está em separação' });
        if (!c.itens[itemIndex]) return res.status(400).json({ error: 'Item inválido' });
        c.itens[itemIndex].separado = !!separado;
        c.atualizadoEm = now;
      } else if (action === 'concluir') {
        if (c.status !== 'separando') return res.status(409).json({ error: 'Comanda não está em separação' });
        c.status = 'concluida';
        c.atualizadoEm = now;
        c.historico.push({ evento: 'concluida', em: now, por: c.repositor });
      } else if (action === 'cancelar') {
        if (c.status !== 'pendente') return res.status(409).json({ error: 'Só é possível cancelar requisições pendentes' });
        c.status = 'cancelada';
        c.atualizadoEm = now;
        c.historico.push({ evento: 'cancelada', em: now, por: c.encarregado });
      } else {
        return res.status(400).json({ error: 'Ação inválida' });
      }

      list[idx] = c;
      await saveComandas(list);
      return res.status(200).json(c);
    }

    res.setHeader('Allow', ['PATCH']);
    return res.status(405).json({ error: 'Método não permitido' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno ao acessar o banco de dados' });
  }
}
