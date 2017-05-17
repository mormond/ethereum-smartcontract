# ethereum-smartcontract
Repository to hold the smart contracts used for Ethereum blockchain solutions

## Dependencies
### ethereum-consortium-orchestration
Deployment of a Smart Contract assumes that the Ethereum-based blockchain is up and running. If you haven't already done so, do please follow the setup steps at https://github.com/mormond/ethereum-consortium-orchestration.

## Steps to deploy the EnergyExchange.sol Solidity Smart Contract
### 1/ Prepare transaction node to allow SSH console session

1. On the blockchain deployment, look for ...founder-public-ip and record its IP Address.
2. You should have a private key matched to sshPublicKey from the ethereum-consortium-orchestration setup steps.
3. Add this to putty.exe for authentication.
4. Connect to the ...founder-public-ip with putty.exe and log in with the user name and passphrase created during setup.

### 2/ Install the default blockchain account and unlock it for contract deployment

1. Get into the Docker container running Geth by following the following commands adjusting for your own values.
```
azureuser@xd-founder-n-tx000000:~$ sudo docker ps
CONTAINER ID        IMAGE                      COMMAND                  CREATED             STATUS              PORTS                                                                                  NAMES
3331e7ec1fe6        mormond/geth-node:latest   "pm2 start --no-da..."   3 days ago          Up 3 days           0.0.0.0:8545-8546->8545-8546/tcp, 0.0.0.0:30303->30303/tcp, 0.0.0.0:30303->30303/udp   eth-node
 azureuser@xd-founder-n-tx000000:~$ sudo docker exec -it "3331e7ec1fe6" bash
eth-node@xd-founder-n-tx000000-c:~$ cd ~/.geth
```

2. Obtain the account keyfile that was created using EtherWallet in the previous setup and deploy it to the transaction node.
```
eth-node@xd-founder-n-tx000000-c:~/.geth$ curl -O https://meobucket.blob.core.windows.net/ethereum/6D0D451A-D203-4FC3-93A0-EA193D7A12C4.txt && mv 6D0D451A-D203-4FC3-93A0-EA193D7A12C4.txt keystore
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100   489  100   489    0     0   1289      0 --:--:-- --:--:-- --:--:--  1290
eth-node@xd-founder-n-tx000000-c:~/.geth$ ls keystore
6D0D451A-D203-4FC3-93A0-EA193D7A12C4.txt
eth-node@xd-founder-n-tx000000-c:~/.geth$ geth attach ipc:geth.ipc
Welcome to the Geth JavaScript console!

instance: Geth/xd-founder-n-tx000000/v1.5.9-stable-a07539fb/linux/go1.6.2
coinbase: 0x26851571ec7a14209a5144b516798cbcde2a5c65
at block: 26370 (Tue, 16 May 2017 16:31:11 UTC)
datadir: /home/eth-node/.geth
modules: admin:1.0 debug:1.0 eth:1.0 miner:1.0 net:1.0 personal:1.0 rpc:1.0 txpool:1.0 web3:1.0

> eth.accounts
["0x26851571ec7a14209a5144b516798cbcde2a5c65"]
```

3. Unlock the account so we can deploy the Smart Contract using it.
```
>  personal.unlockAccount(eth.accounts[0],"AbcAbc123123!",0)
true
>
```

### 3/ Obtain the EnergyExchange.sol Smart Contract 

1. Connect to the DevVM jump box via RDP.
2. Start a PowerShell session.
3. Run the following commands to create a new project.
```
PS C:\Users\azureuser> md Repos
PS C:\Users\azureuser> cd Repos
PS C:\Users\azureuser\repos> md EnergyExchange
PS C:\Users\azureuser\repos> cd EnergyExchange
PS C:\Users\azureuser\repos\EnergyExchange> truffle init
PS C:\Users\azureuser\repos\EnergyExchange> cd contracts
PS C:\Users\azureuser\repos\EnergyExchange\contracts> notepad EnergyExchange.sol
```

4. Copy contents of EnergyExchange.sol from https://github.com/david-goon/ethereum-smartcontract and save the notepad file.

### 4/ Make changes to Truffle configuration to deploy correctly

1. Modify migrations/deploy_contracts.js to specify you want to deploy EnergyExchange.sol during the migration. 
```
//var ConvertLib = artifacts.require("./ConvertLib.sol");
//var MetaCoin = artifacts.require("./MetaCoin.sol");
var EnergyExchange = artifacts.require("./EnergyExchange.sol");

module.exports = function(deployer) {
//  deployer.deploy(ConvertLib);
//  deployer.link(ConvertLib, MetaCoin);
//  deployer.deploy(MetaCoin);
  deployer.deploy(EnergyExchange);
```

2. Modify truffle.js in the project root to point to the ...founder-public-ip address.
```
module.exports = {
  networks: {
    development: {
      host: "10.0.1.4", // ...founder-public-ip
      port: 8545,
      network_id: "*" // Match any network id
    }
  }
};
```
### 5/ Compile and deploy the EnergyExchange.sol Smart Contract

1. Compile the smart contract.
```
PS C:\users\azureuser\repos\EnergyExchange> truffle compile
Compiling .\contracts\ConvertLib.sol...
Compiling .\contracts\EnergyExchange.sol...
Compiling .\contracts\MetaCoin.sol...
Compiling .\contracts\Migrations.sol...
Writing artifacts to .\build\contracts
```

2. Deploy the smart contract using the migrate command.
```
PS C:\users\azureuser\repos\EnergyExchange> truffle migrate
Using network 'development'.

Running migration: 1_initial_migration.js
  Deploying Migrations...
  Migrations: 0x79966a9a613cca85e7149a193b82f97b69e4c609
Saving successful migration to network...
Saving artifacts...
Running migration: 2_deploy_contracts.js
  Deploying EnergyExchange...
  EnergyExchange: 0x09ee22780cab4f92430fb1f609675d609004a1e8
Saving successful migration to network...
Saving artifacts...
PS C:\users\azureuser\repos\EnergyExchange>
```

### 6/ Collect information needed by the applications that will be calling the Smart Contract

1. Use the Truffle console to verify the Smart Contract address and Application Binary Interface (ABI).
```
PS C:\users\azureuser\repos\EnergyExchange> truffle console
truffle(development)> EnergyExchange.address
'0x09ee22780cab4f92430fb1f609675d609004a1e8'
truffle(development)> JSON.stringify(EnergyExchange.abi)
'[{"constant":true,"inputs":[{"name":"v","type":"uint256"}],"name":"ConvertUintToBytes32","outputs":[{"name":"ret","type
":"bytes32"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"id","type":"string"}],"name":"Sign
Proposal","outputs":[],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"data","type":"bytes32"}],
"name":"ConvertBytes32ToString","outputs":[{"name":"","type":"string"}],"payable":false,"type":"function"},{"constant":f
alse,"inputs":[{"name":"id","type":"string"},{"name":"pA","type":"address"},{"name":"pB","type":"address"}],"name":"Crea
teProposal","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"a","type":"string"},{"na
me":"b","type":"string"}],"name":"StringEquals","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"}
,{"constant":false,"inputs":[{"name":"id","type":"string"}],"name":"IsProposalComplete","outputs":[{"name":"","type":"bo
ol"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"id","type":"string"}],"name":"GetProposal"
,"outputs":[{"name":"pid","type":"string"},{"name":"pA","type":"address"},{"name":"pAS","type":"bool"},{"name":"pB","typ
e":"address"},{"name":"pBS","type":"bool"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"id",
"type":"string"}],"name":"IdExists","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"inputs":[
],"payable":false,"type":"constructor"}]'
truffle(development)>
```

2. Copy and save the above off in a convenient location.

And you are done with Smart Contract deployment!
