# Base da Família V8 Core Limpo

Refatoração completa da lógica.

Inclui:
- Perfil obrigatório ao entrar: Mu/Ju.
- Missões com responsável e executor separados: assignedTo / completedBy.
- Correção central da contagem: todo dashboard, histórico, XP, Dia Perfeito e notificações usam a mesma função.
- Sistemas da casa: Pets, Casa, Financeiro, Relacionamento, Saúde.
- Saúde da Base e saúde por sistema.
- Streak por categoria.
- Missões emergenciais.
- Energia da Base.
- Previsão de sobrecarga.
- Conquistas reais por sistema, tempo e Dia Perfeito.
- Competição saudável Mu x Ju.
- Calendário invisível.
- Missões encadeadas.
- Perfil/avatar com itens liberados por XP.
- Tema claro/escuro.
- OneSignal pronto.
- Netlify Function agendada.

Variáveis do Netlify:
- ONESIGNAL_APP_ID
- ONESIGNAL_API_KEY
- SUPABASE_URL
- SUPABASE_ANON_KEY

Importante:
Esta V8 usa um novo ID no Supabase: base-mu-ju-v8.
Isso evita misturar dados antigos bugados com a base nova.
