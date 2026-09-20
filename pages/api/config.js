import { getConfig, saveConfig } from '../../lib/kv';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const config = await getConfig();
      return res.status(200).json(config);
    }

    if (req.method === 'PATCH') {
      const config = await getConfig();
      const { type, nome, setor } = req.body || {};
      const val = (nome || '').toString().trim();

      if (type === 'addSetor') {
        if (!val) return res.status(400).json({ error: 'Nome do setor vazio' });
        const existe = config.setores.some(s => s.toLowerCase() === val.toLowerCase());
        if (!existe) config.setores.push(val);
        if (!config.produtos[val]) config.produtos[val] = [];
      } else if (type === 'addEncarregado') {
        if (!val) return res.status(400).json({ error: 'Nome vazio' });
        const existe = config.encarregados.some(s => s.toLowerCase() === val.toLowerCase());
        if (!existe) config.encarregados.push(val);
      } else if (type === 'addRepositor') {
        if (!val) return res.status(400).json({ error: 'Nome vazio' });
        const existe = config.repositores.some(s => s.toLowerCase() === val.toLowerCase());
        if (!existe) config.repositores.push(val);
      } else if (type === 'addProduto') {
        if (!setor) return res.status(400).json({ error: 'Setor não informado' });
        if (!val) return res.status(400).json({ error: 'Nome do produto vazio' });
        if (!config.produtos[setor]) config.produtos[setor] = [];
        const existe = config.produtos[setor].some(p => p.toLowerCase() === val.toLowerCase());
        if (!existe) config.produtos[setor].push(val);
      } else {
        return res.status(400).json({ error: 'Tipo de operação inválido' });
      }

      await saveConfig(config);
      return res.status(200).json(config);
    }

    res.setHeader('Allow', ['GET', 'PATCH']);
    return res.status(405).json({ error: 'Método não permitido' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno ao acessar o banco de dados' });
  }
}
