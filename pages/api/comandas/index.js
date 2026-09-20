import { getComandas, saveComandas } from '../../../lib/kv';

function novoId() {
  return 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const list = await getComandas();
      list.sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
      return res.status(200).json(list);
    }

    if (req.method === 'POST') {
      const { encarregado, setor, itens, observacao } = req.body || {};
      if (!encarregado || !setor || !Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({ error: 'Dados incompletos para criar a requisição' });
      }
      const list = await getComandas();
      const now = new Date().toISOString();
      const nova = {
        id: novoId(),
        encarregado,
        setor,
        itens: itens.map(it => ({ nome: String(it.nome), qtd: Number(it.qtd) || 1, separado: false })),
        observacao: observacao ? String(observacao) : '',
        status: 'pendente', // pendente -> separando -> concluida (ou cancelada)
        repositor: null,
        criadoEm: now,
        atualizadoEm: now,
        historico: [{ evento: 'criada', em: now, por: encarregado }]
      };
      list.push(nova);
      await saveComandas(list);
      return res.status(201).json(nova);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Método não permitido' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno ao acessar o banco de dados' });
  }
}
