# Áudio e chamada 2.0.9

A revisão 2.0.9 fecha as falhas observadas na Central da Aventura em dispositivos móveis: efeitos sonoros sem retorno audível, trilhas bloqueadas por ausência de armazenamento externo e chamadas frágeis quando a rota WebRTC muda.

## Efeitos sonoros

- O toque do Narrador ativa o contexto de áudio e reproduz o efeito imediatamente no mesmo dispositivo.
- O evento continua sendo enviado à aventura para que os outros participantes o ouçam depois de terem ativado o áudio.
- O Narrador ignora o eco do próprio evento quando ele retorna do servidor, evitando reprodução duplicada.
- O contexto Web Audio é retomado sempre que não estiver em execução e recebe uma ativação silenciosa compatível com WebViews móveis.
- Silenciar no dispositivo continua silenciando tanto trilha quanto efeitos.

## Trilhas

O limite continua em 24 MB por faixa.

Quando S3/R2 não está configurado, o caminho padrão é:

1. preparar um envio autenticado no Turso;
2. dividir o arquivo em chunks de 512 KB;
3. enviar até três chunks em paralelo, com reenvio seguro;
4. confirmar quantidade e tamanho antes de registrar a mídia;
5. baixar os chunks autenticados e reconstruir um Blob local para reprodução.

Isso remove a dependência obrigatória das variáveis `MYOWNDEX_S3_*`. O bucket privado continua aceito como otimização automática quando estiver configurado.

Uploads interrompidos expiram. Excluir uma trilha remove seus chunks; excluir a aventura usa as relações do banco para remover mídia, uploads pendentes e chunks associados.

## Chamada de voz

A chamada continua usando WebRTC para o áudio e Turso apenas para presença e sinalização. A revisão adiciona:

- Cloudflare STUN e dois endpoints STUN do Google como rota padrão;
- `iceCandidatePoolSize` para preparar candidatos antes da negociação;
- reinício de ICE após falha imediata ou desconexão prolongada;
- máximo de três tentativas automáticas para não entrar em ciclo infinito;
- fallback de `getUserMedia({ audio: true })` quando o dispositivo rejeita constraints avançadas;
- nova tentativa de reprodução do áudio remoto quando o elemento fica pronto;
- mensagem curta e prática em redes sem TURN quando a reconexão não consegue abrir rota.

TURN próprio continua opcional, mas é necessário para alcançar redes que impedem qualquer conexão WebRTC direta.

## Compatibilidade

- Salas, contas, Boxes, códigos e snapshots anteriores continuam válidos.
- Trilhas antigas em S3/R2 continuam sendo abertas pelo caminho anterior quando o bucket correspondente está conectado.
- A mudança de armazenamento não altera o formato público de `snapshot.audio`.
- A interface continua apresentando a linha 2.0, enquanto a versão técnica é 2.0.9.

## Validação obrigatória

A entrega só deve chegar à produção depois de:

- `npm test`;
- `npm run lint`;
- `npm run typecheck`;
- `npm run build`;
- Preview correspondente ao mesmo commit;
- smoke das APIs de aventura quando o ambiente de Preview disponibilizar Turso.

Os testes específicos cobrem BLOBs no driver Turso, upload em chunks, recomposição na ordem correta, limites de tamanho, cancelamento de downloads, configuração ICE e reinício de rotas.
