# 서버 기동: http://127.0.0.1:8090
Set-Location "$PSScriptRoot\src\backend"
python -m app.main @args
