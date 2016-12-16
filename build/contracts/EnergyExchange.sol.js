var Web3 = require("web3");
var SolidityEvent = require("web3/lib/web3/event.js");

(function() {
  // Planned for future features, logging, etc.
  function Provider(provider) {
    this.provider = provider;
  }

  Provider.prototype.send = function() {
    this.provider.send.apply(this.provider, arguments);
  };

  Provider.prototype.sendAsync = function() {
    this.provider.sendAsync.apply(this.provider, arguments);
  };

  var BigNumber = (new Web3()).toBigNumber(0).constructor;

  var Utils = {
    is_object: function(val) {
      return typeof val == "object" && !Array.isArray(val);
    },
    is_big_number: function(val) {
      if (typeof val != "object") return false;

      // Instanceof won't work because we have multiple versions of Web3.
      try {
        new BigNumber(val);
        return true;
      } catch (e) {
        return false;
      }
    },
    merge: function() {
      var merged = {};
      var args = Array.prototype.slice.call(arguments);

      for (var i = 0; i < args.length; i++) {
        var object = args[i];
        var keys = Object.keys(object);
        for (var j = 0; j < keys.length; j++) {
          var key = keys[j];
          var value = object[key];
          merged[key] = value;
        }
      }

      return merged;
    },
    promisifyFunction: function(fn, C) {
      var self = this;
      return function() {
        var instance = this;

        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {
          var callback = function(error, result) {
            if (error != null) {
              reject(error);
            } else {
              accept(result);
            }
          };
          args.push(tx_params, callback);
          fn.apply(instance.contract, args);
        });
      };
    },
    synchronizeFunction: function(fn, instance, C) {
      var self = this;
      return function() {
        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {

          var decodeLogs = function(logs) {
            return logs.map(function(log) {
              var logABI = C.events[log.topics[0]];

              if (logABI == null) {
                return null;
              }

              var decoder = new SolidityEvent(null, logABI, instance.address);
              return decoder.decode(log);
            }).filter(function(log) {
              return log != null;
            });
          };

          var callback = function(error, tx) {
            if (error != null) {
              reject(error);
              return;
            }

            var timeout = C.synchronization_timeout || 240000;
            var start = new Date().getTime();

            var make_attempt = function() {
              C.web3.eth.getTransactionReceipt(tx, function(err, receipt) {
                if (err) return reject(err);

                if (receipt != null) {
                  // If they've opted into next gen, return more information.
                  if (C.next_gen == true) {
                    return accept({
                      tx: tx,
                      receipt: receipt,
                      logs: decodeLogs(receipt.logs)
                    });
                  } else {
                    return accept(tx);
                  }
                }

                if (timeout > 0 && new Date().getTime() - start > timeout) {
                  return reject(new Error("Transaction " + tx + " wasn't processed in " + (timeout / 1000) + " seconds!"));
                }

                setTimeout(make_attempt, 1000);
              });
            };

            make_attempt();
          };

          args.push(tx_params, callback);
          fn.apply(self, args);
        });
      };
    }
  };

  function instantiate(instance, contract) {
    instance.contract = contract;
    var constructor = instance.constructor;

    // Provision our functions.
    for (var i = 0; i < instance.abi.length; i++) {
      var item = instance.abi[i];
      if (item.type == "function") {
        if (item.constant == true) {
          instance[item.name] = Utils.promisifyFunction(contract[item.name], constructor);
        } else {
          instance[item.name] = Utils.synchronizeFunction(contract[item.name], instance, constructor);
        }

        instance[item.name].call = Utils.promisifyFunction(contract[item.name].call, constructor);
        instance[item.name].sendTransaction = Utils.promisifyFunction(contract[item.name].sendTransaction, constructor);
        instance[item.name].request = contract[item.name].request;
        instance[item.name].estimateGas = Utils.promisifyFunction(contract[item.name].estimateGas, constructor);
      }

      if (item.type == "event") {
        instance[item.name] = contract[item.name];
      }
    }

    instance.allEvents = contract.allEvents;
    instance.address = contract.address;
    instance.transactionHash = contract.transactionHash;
  };

  // Use inheritance to create a clone of this contract,
  // and copy over contract's static functions.
  function mutate(fn) {
    var temp = function Clone() { return fn.apply(this, arguments); };

    Object.keys(fn).forEach(function(key) {
      temp[key] = fn[key];
    });

    temp.prototype = Object.create(fn.prototype);
    bootstrap(temp);
    return temp;
  };

  function bootstrap(fn) {
    fn.web3 = new Web3();
    fn.class_defaults  = fn.prototype.defaults || {};

    // Set the network iniitally to make default data available and re-use code.
    // Then remove the saved network id so the network will be auto-detected on first use.
    fn.setNetwork("default");
    fn.network_id = null;
    return fn;
  };

  // Accepts a contract object created with web3.eth.contract.
  // Optionally, if called without `new`, accepts a network_id and will
  // create a new version of the contract abstraction with that network_id set.
  function Contract() {
    if (this instanceof Contract) {
      instantiate(this, arguments[0]);
    } else {
      var C = mutate(Contract);
      var network_id = arguments.length > 0 ? arguments[0] : "default";
      C.setNetwork(network_id);
      return C;
    }
  };

  Contract.currentProvider = null;

  Contract.setProvider = function(provider) {
    var wrapped = new Provider(provider);
    this.web3.setProvider(wrapped);
    this.currentProvider = provider;
  };

  Contract.new = function() {
    if (this.currentProvider == null) {
      throw new Error("EnergyExchange error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("EnergyExchange error: contract binary not set. Can't deploy new instance.");
    }

    var regex = /__[^_]+_+/g;
    var unlinked_libraries = this.binary.match(regex);

    if (unlinked_libraries != null) {
      unlinked_libraries = unlinked_libraries.map(function(name) {
        // Remove underscores
        return name.replace(/_/g, "");
      }).sort().filter(function(name, index, arr) {
        // Remove duplicates
        if (index + 1 >= arr.length) {
          return true;
        }

        return name != arr[index + 1];
      }).join(", ");

      throw new Error("EnergyExchange contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of EnergyExchange: " + unlinked_libraries);
    }

    var self = this;

    return new Promise(function(accept, reject) {
      var contract_class = self.web3.eth.contract(self.abi);
      var tx_params = {};
      var last_arg = args[args.length - 1];

      // It's only tx_params if it's an object and not a BigNumber.
      if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
        tx_params = args.pop();
      }

      tx_params = Utils.merge(self.class_defaults, tx_params);

      if (tx_params.data == null) {
        tx_params.data = self.binary;
      }

      // web3 0.9.0 and above calls new twice this callback twice.
      // Why, I have no idea...
      var intermediary = function(err, web3_instance) {
        if (err != null) {
          reject(err);
          return;
        }

        if (err == null && web3_instance != null && web3_instance.address != null) {
          accept(new self(web3_instance));
        }
      };

      args.push(tx_params, intermediary);
      contract_class.new.apply(contract_class, args);
    });
  };

  Contract.at = function(address) {
    if (address == null || typeof address != "string" || address.length != 42) {
      throw new Error("Invalid address passed to EnergyExchange.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: EnergyExchange not deployed or address not set.");
    }

    return this.at(this.address);
  };

  Contract.defaults = function(class_defaults) {
    if (this.class_defaults == null) {
      this.class_defaults = {};
    }

    if (class_defaults == null) {
      class_defaults = {};
    }

    var self = this;
    Object.keys(class_defaults).forEach(function(key) {
      var value = class_defaults[key];
      self.class_defaults[key] = value;
    });

    return this.class_defaults;
  };

  Contract.extend = function() {
    var args = Array.prototype.slice.call(arguments);

    for (var i = 0; i < arguments.length; i++) {
      var object = arguments[i];
      var keys = Object.keys(object);
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        var value = object[key];
        this.prototype[key] = value;
      }
    }
  };

  Contract.all_networks = {
  "default": {
    "abi": [
      {
        "constant": true,
        "inputs": [
          {
            "name": "v",
            "type": "uint256"
          }
        ],
        "name": "ConvertUintToBytes32",
        "outputs": [
          {
            "name": "ret",
            "type": "bytes32"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "id",
            "type": "string"
          }
        ],
        "name": "SignProposal",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "data",
            "type": "bytes32"
          }
        ],
        "name": "ConvertBytes32ToString",
        "outputs": [
          {
            "name": "",
            "type": "string"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "id",
            "type": "string"
          },
          {
            "name": "pA",
            "type": "address"
          },
          {
            "name": "pB",
            "type": "address"
          }
        ],
        "name": "CreateProposal",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "a",
            "type": "string"
          },
          {
            "name": "b",
            "type": "string"
          }
        ],
        "name": "StringEquals",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "id",
            "type": "string"
          }
        ],
        "name": "IsProposalComplete",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "id",
            "type": "string"
          }
        ],
        "name": "GetProposal",
        "outputs": [
          {
            "name": "pid",
            "type": "string"
          },
          {
            "name": "pA",
            "type": "address"
          },
          {
            "name": "pAS",
            "type": "bool"
          },
          {
            "name": "pB",
            "type": "address"
          },
          {
            "name": "pBS",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "id",
            "type": "string"
          }
        ],
        "name": "IdExists",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "inputs": [],
        "payable": false,
        "type": "constructor"
      }
    ],
    "unlinked_binary": "0x606060405234610000575b60008054600160a060020a03191633600160a060020a03161790555b5b610d63806100366000396000f300606060405236156100725763ffffffff60e060020a600035041663260e584b81146100775780633364b3351461009957806336afbb97146100ee578063547867d11461017e57806381c8ca65146101e557806386432e1f14610289578063ba87b23d146102f0578063bff35e75146103f5575b610000565b346100005761008760043561045c565b60408051918252519081900360200190f35b34610000576100ec600480803590602001908201803590602001908080601f016020809104026020016040519081016040528093929190818152602001838380828437509496506104b995505050505050565b005b34610000576100fe600435610690565b604080516020808252835181830152835191928392908301918501908083838215610144575b80518252602083111561014457601f199092019160209182019101610124565b505050905090810190601f1680156101705780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34610000576100ec600480803590602001908201803590602001908080601f0160208091040260200160405190810160405280939291908181526020018383808284375094965050600160a060020a0385358116956020013516935061073e92505050565b005b3461000057610275600480803590602001908201803590602001908080601f0160208091040260200160405190810160405280939291908181526020018383808284375050604080516020601f89358b018035918201839004830284018301909452808352979998810197919650918201945092508291508401838280828437509496506109d095505050505050565b604080519115158252519081900360200190f35b3461000057610275600480803590602001908201803590602001908080601f01602080910402602001604051908101604052809392919081815260200183838082843750949650610a8595505050505050565b604080519115158252519081900360200190f35b3461000057610343600480803590602001908201803590602001908080601f01602080910402602001604051908101604052809392919081815260200183838082843750949650610b7395505050505050565b60408051600160a060020a038087166020808401919091528615159383019390935284166060820152821515608082015260a080825287519082015286519091829160c083019189019080838382156103b7575b8051825260208311156103b757601f199092019160209182019101610397565b505050905090810190601f1680156103e35780820380516001836020036101000a031916815260200191505b50965050505050505060405180910390f35b3461000057610275600480803590602001908201803590602001908080601f01602080910402602001604051908101604052809392919081815260200183838082843750949650610cc095505050505050565b604080519115158252519081900360200190f35b600081151561048c57507f30000000000000000000000000000000000000000000000000000000000000006104b2565b5b60008211156104b257600a808304920660300160f860020a026101009091041761048d565b5b5b919050565b60006104c482610cc0565b15610689576001826040518082805190602001908083835b602083106104fb5780518252601f1990920191602091820191016104dc565b51815160209384036101000a60001901801990921691161790529201948552506040519384900301909220600181015490935033600160a060020a039081169116141591506105dd90505760016001836040518082805190602001908083835b6020831061057a5780518252601f19909201916020918201910161055b565b51815160209384036101000a60001901801990921691161790529201948552506040519384900301909220600201805474ff0000000000000000000000000000000000000000191660a060020a9415159490940293909317909255506106899050565b600281015433600160a060020a03908116911614156106895760016001836040518082805190602001908083835b6020831061062a5780518252601f19909201916020918201910161060b565b51815160209384036101000a60001901801990921691161790529201948552506040519384900301909220600201805475ff000000000000000000000000000000000000000000191660a860020a941515949094029390931790925550505b5b5b5b5050565b602060405190810160405280600081525060206040519081016040528060008152506000600060206040518059106106c55750595b908082528060200260200182016040525b509250600091505b602082101561073257506008810260020a8402600160f860020a031981161561072657808383815181101561000057906020010190600160f860020a031916908160001a9053505b5b6001909101906106de565b8293505b505050919050565b6040805160e081018252600060c08201818152825260208201819052918101829052606081018290526080810182905260a08101829052905433600160a060020a0390811691161461078f576109ca565b61079884610cc0565b156107a2576109ca565b60c06040519081016040528085815260200184600160a060020a0316815260200183600160a060020a03168152602001600015158152602001600015158152602001600115158152509050806001856040518082805190602001908083835b602083106108205780518252601f199092019160209182019101610801565b6001836020036101000a03801982511681845116808217855250505050505090500191505090815260200160405180910390206000820151816000019080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106108a557805160ff19168380011785556108d2565b828001600101855582156108d2579182015b828111156108d25782518255916020019190600101906108b7565b5b506108f39291505b808211156108ef57600081556001016108db565b5090565b50506020820151600182018054600160a060020a0392831673ffffffffffffffffffffffffffffffffffffffff19918216179091556040840151600290930180546060860151608087015160a090970151151560b060020a0276ff000000000000000000000000000000000000000000001997151560a860020a0275ff0000000000000000000000000000000000000000001992151560a060020a0274ff00000000000000000000000000000000000000001998909716939095169290921795909516939093179390931617929092169190911790555b50505050565b60408051602081810183526000918290528251908101909252908190528151835184918491849114610a055760009350610a7c565b5060005b8251811015610a7657818181518110156100005790602001015160f860020a900460f860020a02600160f860020a031916838281518110156100005760209101015160f860020a9081900402600160f860020a03191614610a6d5760009350610a7c565b5b600101610a09565b5b600193505b50505092915050565b60006001826040518082805190602001908083835b60208310610ab95780518252601f199092019160209182019101610a9a565b51815160209384036101000a600019018019909216911617905292019485525060405193849003019092206002015460a060020a900460ff169150508015610b6b57506001826040518082805190602001908083835b60208310610b2e5780518252601f199092019160209182019101610b0f565b51815160209384036101000a600019018019909216911617905292019485525060405193849003019092206002015460a860020a900460ff169150505b90505b919050565b6020604051908101604052806000815250600060006000600060006001876040518082805190602001908083835b60208310610bc05780518252601f199092019160209182019101610ba1565b518151600019602094850361010090810a820192831692199390931691909117909252949092019687526040805197889003820188208054601f6002600183161590980290950116959095049283018290048202880182019052818752929650869450925050830182828015610c775780601f10610c4c57610100808354040283529160200191610c77565b820191906000526020600020905b815481529060010190602001808311610c5a57829003601f168201915b50505060018401546002850154939950600160a060020a03908116985060ff60a060020a850481169850908416965060a860020a909304909216935050505b5091939590929450565b60006001826040518082805190602001908083835b60208310610cf45780518252601f199092019160209182019101610cd5565b51815160209384036101000a600019018019909216911617905292019485525060405193849003019092206002015460b060020a900460ff16925050505b9190505600a165627a7a72305820474b7bd3b78f04f43680cc34207ca99d55525d6ea4f27eef39e70969af84ff3c0029",
    "events": {},
    "updated_at": 1481908729845,
    "links": {},
    "address": "0xf38373df421bd0b03902cb981d70ca4e2de28307"
  }
};

  Contract.checkNetwork = function(callback) {
    var self = this;

    if (this.network_id != null) {
      return callback();
    }

    this.web3.version.network(function(err, result) {
      if (err) return callback(err);

      var network_id = result.toString();

      // If we have the main network,
      if (network_id == "1") {
        var possible_ids = ["1", "live", "default"];

        for (var i = 0; i < possible_ids.length; i++) {
          var id = possible_ids[i];
          if (Contract.all_networks[id] != null) {
            network_id = id;
            break;
          }
        }
      }

      if (self.all_networks[network_id] == null) {
        return callback(new Error(self.name + " error: Can't find artifacts for network id '" + network_id + "'"));
      }

      self.setNetwork(network_id);
      callback();
    })
  };

  Contract.setNetwork = function(network_id) {
    var network = this.all_networks[network_id] || {};

    this.abi             = this.prototype.abi             = network.abi;
    this.unlinked_binary = this.prototype.unlinked_binary = network.unlinked_binary;
    this.address         = this.prototype.address         = network.address;
    this.updated_at      = this.prototype.updated_at      = network.updated_at;
    this.links           = this.prototype.links           = network.links || {};
    this.events          = this.prototype.events          = network.events || {};

    this.network_id = network_id;
  };

  Contract.networks = function() {
    return Object.keys(this.all_networks);
  };

  Contract.link = function(name, address) {
    if (typeof name == "function") {
      var contract = name;

      if (contract.address == null) {
        throw new Error("Cannot link contract without an address.");
      }

      Contract.link(contract.contract_name, contract.address);

      // Merge events so this contract knows about library's events
      Object.keys(contract.events).forEach(function(topic) {
        Contract.events[topic] = contract.events[topic];
      });

      return;
    }

    if (typeof name == "object") {
      var obj = name;
      Object.keys(obj).forEach(function(name) {
        var a = obj[name];
        Contract.link(name, a);
      });
      return;
    }

    Contract.links[name] = address;
  };

  Contract.contract_name   = Contract.prototype.contract_name   = "EnergyExchange";
  Contract.generated_with  = Contract.prototype.generated_with  = "3.2.0";

  // Allow people to opt-in to breaking changes now.
  Contract.next_gen = false;

  var properties = {
    binary: function() {
      var binary = Contract.unlinked_binary;

      Object.keys(Contract.links).forEach(function(library_name) {
        var library_address = Contract.links[library_name];
        var regex = new RegExp("__" + library_name + "_*", "g");

        binary = binary.replace(regex, library_address.replace("0x", ""));
      });

      return binary;
    }
  };

  Object.keys(properties).forEach(function(key) {
    var getter = properties[key];

    var definition = {};
    definition.enumerable = true;
    definition.configurable = false;
    definition.get = getter;

    Object.defineProperty(Contract, key, definition);
    Object.defineProperty(Contract.prototype, key, definition);
  });

  bootstrap(Contract);

  if (typeof module != "undefined" && typeof module.exports != "undefined") {
    module.exports = Contract;
  } else {
    // There will only be one version of this contract in the browser,
    // and we can use that.
    window.EnergyExchange = Contract;
  }
})();
