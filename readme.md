# Base da Família v7.2 - Correções

Correções:
- Progresso do dia agora reconhece tarefa feita pelo dueDate e pela data real de conclusão.
- Função Netlify send-push reescrita em CommonJS para evitar erro de deploy/runtime.
- Função aceita ONESIGNAL_API_KEY ou ONESIGNAL_REST_API_KEY.
- Mantém OneSignal App ID configurado.
- Mantém notificações inteligentes e competição saudável.

Depois de subir:
1. Commit e Push.
2. Aguarde deploy no Netlify.
3. No PC, faça hard refresh.
4. No celular:
   - iPhone: abrir no Safari > Compartilhar > Adicionar à Tela de Início.
   - Abrir pelo ícone instalado.
   - Entrar em 🔔 Avisos > Ativar push real.
5. Testar botão Teste servidor.

Observação:
Teste local funciona só no aparelho atual. Push real com app fechado só funciona em aparelhos que clicaram em Ativar push real e aceitaram notificação.
