========Step1==============
cd "C:\ReleaseBuildCode"
Remove-Item .\Code -Force -Recurse
git clone https://utilidex.visualstudio.com/DefaultCollection/Utilidex%20-%20BChain/_git/BChainSmartContract --branch jjcollinge/truffle3 --single-branch Code
 
=========Step 2===========
$ENV:path+=";c:\users\azureuser\appdata\roaming\npm"
cd "C:\ReleaseBuildCode\code"
truffle compile

========Step3============
$ENV:path+=";c:\users\azureuser\appdata\roaming\npm"
cd "C:\ReleaseBuildCode\code"
truffle migrate --network azure --reset