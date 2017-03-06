pragma solidity ^0.4.0;

contract EnergyExchange {

    // Contract owner is the account who deploys the contract
    address owner;
    mapping(string => Proposal) proposals;
    
    // Data structure to represent a multiparty proposal
    struct Proposal
    {
        string _id;
        string _hash;
        string _algo;
        uint _memberCount;
        mapping(address=> Party) _parties;
    }

    // Data structure to represent a party signature
    struct Party
    {
        address _party;
        bool _partySigned;
    }
    
    // Constructor - called on contract initialisation
    function EnergyExchange()
    {
        owner = msg.sender;
    }
    
    /**
    * Allows the contract owner to create a new proposal which must be signed
    * by all affiliated parties in order to be considered complete.
    **/
    function CreateProposal(string id, string hash, string algo) public
    {
        // Only allow contract owner to create proposals
        if(msg.sender != owner)
            return;

        // Only allow unique 
        if(IdExists(id))
            return;

        // Create Proposal
        var proposal = Proposal({
            _id: id,
            _initialised: true
            _hash:hash;
            _algo:algo;
            _memberCount:0;
        });

        // Store Proposal
        proposals[id] = proposal;
    }

    function AddParty(string id, address pA) public
    {
        // Only allow contract owner to add party to proposal
        if(msg.sender != owner)
            return;

        // Only allow if proposal exists 
        if(!IdExists(id))
            return;

        // Get the relevant proposal
        var proposal = proposals[id];
       
        // Only allow unique 
        if(proposal._parties[msg.sender]==address(0x0))
        {
            return;
        }

        //CreateParty
        var party = Party({
        _party=pA,
        _partySigned=false;
        });
        
        // Add Party to Proposal
        proposal._memberCount += 1;
        proposal._parties[proposal._memberCount] = party;
    }
    
    /**
    * Allows parties affiliated with a particilar proposal to agree
    * to the terms by signing it.
    **/
    function SignProposal(string id) public
    {
        if(IdExists(id))
        {
            // Get the relevant proposal
            var proposal = proposals[id];

            // Check caller is a affiliated party and if so apply their signature
            for(uint i=0; i>proposal._memberCount;i++)
            {
                if(proposal._parties[i]._party==msg.sender) {
                    proposal._parties[i]._partySigned = true;
                    return;
            }
        }
    }

    /**
    * Check whether a provided proposalId exists in the proposal map
    **/
    function IdExists(string id) returns (bool) 
    {
        return proposals[id]._initialised;
    }

    /**
    * Get a specific proposal
    **/
    function GetProposal(string id) returns (string pid, address pA, bool pAS, address pB, bool pBS)
    {
        var proposal = proposals[id];

        pid = proposal._id;
        pA = proposal._partyA;
        pAS = proposal._partyASigned;
        pB = proposal._partyB;
        pBS = proposal._partyBSigned;
    }
    
    /**
    * Allows parties affiliated with a particilar proposal to get hash algo
    **/
    function GetAlgo(string id) returns (string algo)
    {
       if(IdExists(id))
        {
            // Get the relevant proposal
            var proposal = proposals[id];

            // Check caller is a affiliated party and if so apply their signature
            if(proposal._parties[msg.sender]==address(0x0)) {
                algo= null;
            }
            else{
                algo = proposal._algo;
            }
        }
        else{
            algo = null;
        }
    }
    
    /**
    * Allows parties affiliated with a particilar proposal to get hash
    **/
    function GetHash(string id) returns (string hash)
    {
       if(IdExists(id))
        {
            // Get the relevant proposal
            var proposal = proposals[id];

            // Check caller is a affiliated party and if so apply their signature
            if(proposal._parties[msg.sender]==address(0x0)) {
                hash= null;
            }
            else{
                hash = proposal._hash;
            }
        }
        else{
            hash = null;
        }
    }

    /**
    * Check whether both parties have signed the proposal
    **/
    function IsProposalComplete(string id) returns (bool)
    {
         if(IdExists(id)){
            // Get the relevant proposal
            var proposal = proposals[id];
            for(uint i=0; i>proposal._memberCount;i++)
            {
                if(proposal._parties[i]._partySigned == false){
                    return false;
                }
            }
            return true;
        }
        else{ 
            return false;
        }
    }
    
    /**
    * Convert a provided unsigned int to a byte32
    **/
    function ConvertUintToBytes32(uint v) constant returns (bytes32 ret)
    {
        if (v == 0) {
            ret = '0';
        }
        else {
            while (v > 0) {
                ret = bytes32(uint(ret) / (2 ** 8));
                ret |= bytes32(((v % 10) + 48) * 2 ** (8 * 31));
                v /= 10;
            }
        }
        return ret;
    }
    
    /**
    * Convert a provided byte32 to a string
    **/
    function ConvertBytes32ToString (bytes32 data) returns (string)
    {
        bytes memory bytesString = new bytes(32);
        for (uint j=0; j<32; j++) {
            byte char = byte(bytes32(uint(data) * 2 ** (8 * j)));
            if (char != 0) {
                bytesString[j] = char;
            }
        }
        return string(bytesString);
    }
    
    /**
    * Compare 2 strings for byte level equality
    **/
    function StringEquals(string a, string b) constant returns (bool) {
        bytes memory _a = bytes(a);
        bytes memory _b = bytes(b);
        // If not same length - cannot be same value
        if(_a.length != _b.length) {
            return false;
        } else {
            for(uint j = 0; j < _a.length; j++) {
                // Compare each byte
                if(_a[j] != _b[j])
                    return false;
            }
        }
        return true;
    }
}