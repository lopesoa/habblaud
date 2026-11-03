# Escritório personalizado

Este fork adiciona **Meu escritório** à barra superior. As escolhas ficam no arquivo local `dashboard.json` do diretório de dados do servidor; não são publicadas no GitHub.

## Projetos

Cadastre um nome e o caminho completo da pasta, ou importe os projetos encontrados no computador. Novos cadastros começam **ocultos**. Marque **Mostrar no escritório** e salve para manter a sala no mapa, mesmo sem nenhuma sessão aberta. Desmarque para ocultar um projeto inclusive quando ele estiver executando.

O filtro é aplicado no servidor ao mapa, personagens, feed, avisos, detalhes e histórico de sessões. Mudar a seleção fecha os streams de terminal já abertos. **Meu dia, timelapse e entregas agregadas antigas ficam indisponíveis nesta versão**, pois esses registros podem conter projetos agora ocultos. A seleção não apaga nem encerra conversas. Administradores da máquina ainda podem acessar os arquivos pelos aplicativos de origem.

O painel de gerenciamento permite ver os projetos detectados para escolher quais cadastrar; abra-o somente quando quiser gerenciar essa lista.

## Personagens

Crie nomes e aparências na aba Personagens e associe-os ao projeto na ordem desejada. A primeira sessão usa o primeiro personagem, a segunda usa o seguinte. Se houver mais sessões que personagens, o elenco se repete com sufixos numéricos. As atribuições são estáveis durante a presença das sessões. Sem elenco, usa-se um avatar neutro fixo identificado como **Agente sem personagem**. O mapa não cria agentes ou trabalho fictícios para preencher salas vazias.

## Empresas e cenários

Os registros de empresas possuem nome, ramo e cor editáveis. Cada sala recebe a identidade da empresa associada. Os cenários têm cores próprias de piso e paredes e decoração pixel art de construção, navio e cais, linha de embalagem, soja/milho/algodão, armazém com silos, arquitetura e escritório do CSC.

Os nomes iniciais correspondem às empresas do grupo; ramo e cor podem ser ajustados. Duas empresas podem usar o mesmo cenário.

## Contas

Somente **Codex X** fica ativo inicialmente. Outras contas são desmarcadas sem apagar autenticação ou histórico.

O link **Abrir gerenciador de contas no Windows** chama o aplicativo local pelo protocolo `habblaud-contas://open`:

1. Escolha um perfil existente ou clique em **Adicionar conta Codex**.
2. Clique em **Entrar na conta**. Se necessário, o instalador oficial prepara a CLI desse perfil antes do login.
3. Depois de entrar no navegador, clique em **Atualizar status**.
4. Clique em **Conectar esta conta ao Habblaud**. O aplicativo instala os hooks e atualiza as montagens do Docker, preservando as contas existentes.
5. Abra o Codex desse perfil e aprove seus hooks em `/hooks`.

O aplicativo não lê nem copia arquivos de autenticação. Cada perfil usa seu próprio `CODEX_HOME`. A conexão reinicia o container do Habblaud; não reinicia nem encerra os agentes do Codex.

O código do aplicativo está em `desktop/`. Para gerar o executável Windows com Python e PyInstaller:

```powershell
python -m pip install pyinstaller
python -m PyInstaller --onefile --windowed --name "Habblaud Contas" desktop/codex_contas.py
```

O Habblaud World deve permanecer desligado nesta configuração local (`HABBLAUD_WORLD=0`). Esta personalização não altera seu protocolo nem envia atividade inventada a serviços externos.
