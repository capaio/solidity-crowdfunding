const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const web3 = new Web3(ganache.provider());

const compiledCampaignFactory = require('../ethereum/build/CampaignFactory.json');
const compiledCampaign = require('../ethereum/build/Campaign.json');

let accounts;
let factory;
let campaignAddress;
let campaign;

beforeEach(async() => {
  accounts = await web3.eth.getAccounts();

  //deploy a new contract factory from first account with tot gas
  factory = await new web3.eth.Contract(JSON.parse(compiledCampaignFactory.interface))
    .deploy({ data: compiledCampaignFactory.bytecode })
    .send({ from: accounts[0], gas: 1000000 });

  //create a new campaign from first account with tot gas
  await factory.methods.createCampaign(100).send({
    from: accounts[0],
    gas: 1000000
  });

  //get the addresses of the newly created campaign
  const deployedCampaigns = await factory.methods.getDeployedCampaigns().call({
    from: accounts[0]
  });

  //we get the first (and only) campaign address
  campaignAddress = deployedCampaigns[0];

  //get deployed campaign
  campaign = await new web3.eth.Contract(
    JSON.parse(compiledCampaign.interface),
    campaignAddress
  );
})


describe('Campaigns', () => {
  it('deploys a factory and a campaign', () => {
    assert.ok(factory.options.address);
    assert.ok(campaign.options.address);
  });
});

describe('Campaigns', () => {
  it('marks caller as the campaign manager', async() => {
    const manager = await campaign.methods.manager().call();
    assert.equal(accounts[0], manager);
  });
});

describe('Campaigns', () => {
  it('allows people to contribute money and marks them as approvers', async() => {
    await campaign.methods.contribute().send({
      value: 200,
      from: accounts[1]
    });

    const isContributor = await campaign.methods.approvers(accounts[1]).call();
    assert(isContributor);
  });

  it('requires a minimum contribution', async() => {

    await assert.rejects(
      async() => {
        await campaign.methods.contribute().send({
          value: 5,
          from: accounts[1]
        });
      },
      Error,
      'VM Exception while processing transaction: revert'
    );
  });

  it('allows a manager to make a payment request', async() => {


    await campaign.methods
      .createRequest('Buy stuff', 100, accounts[1])
      .send({
        from: accounts[0],
        gas: 1000000
      });

    const request = await campaign.methods.requests(0).call();

    assert.equal('Buy stuff', request.description);
  });

  it('processes requests', async() => {

    let startingBalance =  await web3.eth.getBalance(accounts[1]);
    startingBalance = web3.utils.fromWei(startingBalance, 'ether');
    startingBalance = parseFloat(startingBalance);

    await campaign.methods.contribute().send({
      from: accounts[0],
      value: web3.utils.toWei('10', 'ether')
    });

    await campaign.methods
      .createRequest('A description', web3.utils.toWei('5', 'ether'), accounts[1])
      .send({
        from: accounts[0],
        gas: 1000000
      });

    await campaign.methods.approveRequest(0).send({
      from: accounts[0],
      gas: 1000000
    });

    await campaign.methods.finalizeRequest(0).send({
      from: accounts[0],
      gas: 1000000
    });

    let balance = await web3.eth.getBalance(accounts[1]);

    balance = web3.utils.fromWei(balance, 'ether');

    balance = parseFloat(balance);

    assert(balance > startingBalance);

  });

  it('Does not allow a not manager to create a request', async() => {

    await assert.rejects(
      async() => {
        await campaign.methods
          .createRequest('A description', web3.utils.toWei('5', 'ether'), accounts[1])
          .send({
            from: accounts[2],
            gas: 1000000
          });
      },
      Error,
      'VM Exception while processing transaction: revert'
    );

  });



});
