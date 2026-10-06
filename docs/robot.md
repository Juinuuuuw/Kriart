# Robot animado

O fluxo principal (`frontend/index.html` e `main_new.js`) usa `robot.js`,
`robot-story.css` e `experience.css` para animar nove poses do mascote e a sequência `robot_painting`.
São cinco poses originais e quatro imagens novas geradas com o `image_gen`
integrado, usando o Robot original como referência. Não há novos serviços
nem dependências de produção.

As novas imagens estão em `frontend/static/img/robot/`, em PNG com canal
alpha transparente, preservando os arquivos originais:

| Arquivo | Pose e uso |
| --- | --- |
| `RobotWaving.png` | Aceno de boas-vindas na escolha da causa |
| `RobotInspired.png` | Ideia, estilo visual e faíscas coletadas |
| `RobotHeart.png` | Acolhimento, escolha da causa e criação da frase |
| `RobotVictory.png` | Todas as faíscas coletadas e arte concluída |

Os prompts completos e as referências usadas estão em
[`robot-image-prompts.json`](robot-image-prompts.json).

A entrada também tem quatro imagens próprias, geradas com o `image_gen`
integrado a partir das mesmas referências, em PNG transparente na mesma pasta:

| Arquivo | Pose na queda |
| --- | --- |
| `RobotFalling.png` | No ar, desequilibrado, com braços erguidos e expressão surpresa |
| `RobotBracing.png` | Encolhido, com braços à frente, preparando o pouso |
| `RobotLanded.png` | Impacto sentado no chão, mãos apoiadas e olhos apertados |
| `RobotGettingUp.png` | Ajoelhado, apoiando uma mão para se levantar |

Os prompts dessa sequência estão em [`robot-fall-prompts.json`](robot-fall-prompts.json).
São quatro poses-chave desenhadas para a ação. A cena combina a troca dessas
imagens com deslocamento e quique em CSS, terminando no aceno `RobotWaving`.
As imagens originais foram preservadas.

- Nas escolhas, o Robot alterna expressões, acompanha a digitação e comemora
  a seleção de causa, ideia e estilo.
- Na espera, as etapas seguem as chamadas reais de preparação do prompt,
  geração da imagem e montagem do Polaroid. Não há porcentagem simulada.
- Cinco faíscas podem ser coletadas por toque, clique ou teclado. Cada uma
  conta uma vez e provoca uma comemoração. A brincadeira é opcional e não
  interfere na geração, no tempo de espera ou no resultado.
- Em caso de falha, o Robot deixa de pintar e oferece a nova tentativa já
  disponível no fluxo. As faíscas coletadas são preservadas na tentativa.
- No resultado, o Robot comemora a criação. Uma nova criação reinicia a
  experiência, como já ocorria no projeto.

A animação para em abas ocultas e respeita `prefers-reduced-motion`. O botão
“Pausar Robot” permite interromper os movimentos durante a sessão. Em telas
menores, o mascote fica acima das opções para não cobrir os controles.

Para ajustar a personalidade, edite `POSES`, `stepPose` e `STAGES` em
`frontend/static/js/robot.js`. Novos estados da geração devem ser conectados
a respostas da API usando `setRobotStage`, nunca a um cronômetro estimado.

## Missão guiada pelo personagem

`robot-story.js` e `robot-story.css` conduzem a narrativa. Na primeira entrada
na escolha de causa, o Robot cai do alto, quica no chão, se recompõe e fala
em um balão: “Agora quero que você escolha uma causa”. A cena dura cerca de
quatro segundos até o convite; “Bora escolher!”, “Pular entrada” ou Escape
permitem sair imediatamente. O foco volta ao cartão da causa.

As poses da entrada são carregadas e decodificadas antes da queda. Se alguma
falhar ou o carregamento passar de 2,5 segundos, o convite aparece diretamente.
Pular também invalida qualquer carregamento pendente. A ordem é queda (0 ms),
preparação (650 ms), impacto (1050 ms), levantamento (2300 ms) e aceno (3900 ms).

O marcador acompanha quatro conquistas: causa, ideia, estilo e arte. O Robot
comenta cada etapa e a missão só fica completa quando o Polaroid está pronto.
Esse marcador substitui o coletor antigo de escolhas no fluxo principal.
Os textos ficam no objeto `SCRIPT` do módulo de narrativa.

Os balões revelam o texto progressivamente e disponibilizam a frase inteira
para leitores de tela. “Ouvir Robot” ativa narração opcional com a voz em
português disponível no navegador/sistema; ela começa desligada. A voz real
e sua disponibilidade variam por dispositivo. Trocar de etapa, pular a cena,
silenciar ou ocultar a aba cancela a fala. Não há serviço novo de áudio.

Com movimento reduzido ou Robot pausado, o convite aparece diretamente,
sem queda ou digitação animada. Temporizadores da entrada são cancelados
ao sair dela para não interromper outra etapa depois.

## Verificação local

O layout principal usa a mesma paleta, tipografia, botões e composição da
entrada em todas as etapas. `experience.css` é o sistema visual compartilhado;
o fluxo principal não carrega mais `main.css` nem `robot.css`. Esses arquivos
antigos continuam disponíveis para as páginas legadas que possam usá-los.
As quatro causas aparecem em uma grade, com seleção direta por clique ou teclado.
O resultado mantém as duas versões da arte dentro da mesma composição.

O documento fica fixo à viewport (`100dvh`), sem scrollbar. Nos tamanhos
testados de notebook, desktop e celular, todo o conteúdo cabe na etapa.
Se a janela ficar muito baixa, houver zoom ou um teclado reduzindo o espaço,
a região `.scene` pode rolar por toque, roda do mouse ou foco, sem barra visível,
para manter os controles acessíveis. O conteúdo não é cortado para esconder overflow.

Os testes abrem um navegador headless e um servidor estático temporário,
com respostas de API controladas, sem acessar o banco ou os serviços de IA:

```powershell
python -m pip install playwright
# Se não houver Microsoft Edge instalado:
python -m playwright install chromium
python -m unittest discover -s tests -p test_robot_ui.py -v
```

Cobrem a sequência de etapas, coleta por teclado sem contagem duplicada,
pausa, conclusão sem jogar, falha antecipada, nova tentativa e layout móvel
com movimento reduzido. Também verificam entrada, diálogos, missão, Escape,
foco, cancelamento de falas atrasadas, ordem e carregamento das quatro poses
da queda e continuidade do fluxo quando uma imagem falha. Os controles de voz são testados com
um substituto da síntese de fala; a qualidade do áudio deve ser ouvida no
dispositivo final. A geração real depende de Ollama e Stable Diffusion.

O teste de layout percorre as oito etapas em 1366×768, 1920×1080, 390×844 e
375×667, verifica dimensões do documento e do conteúdo e a posição dos
controles. Também verifica acesso ao último controle em uma janela de 320×480.
