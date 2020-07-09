import React from "react";
import * as SecretJS from "secretjs";
import * as bip39 from "bip39";
import { Hand, Table, Card } from "react-casino";

import { Slider } from "react-semantic-ui-range";
import { Button, Form } from "semantic-ui-react";
import "semantic-ui-css/semantic.min.css";

const nf = new Intl.NumberFormat();
const codeId = 12;

const emptyState = {
  game_address: "",
  all_rooms: [],
  community_cards: [],
  my_hand: [{}, {}],
  player_a_hand: [{}, {}],
  player_b_hand: [{}, {}],
  player_a: "",
  player_a_bet: 0,
  player_a_wallet: 0,
  player_b: "",
  player_b_bet: 0,
  player_b_wallet: 0,
  stage: "",
  turn: "",
  new_room_name: "",
  createLoading: false,
  joinLoading: false,
  checkLoading: false,
  callLoading: false,
  raiseLoading: false,
  raiseAmount: 10000,
};

class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = Object.assign({}, emptyState, {
      game_address: window.location.hash.replace("#", ""),
    });
  }

  async componentDidMount() {
    window.onhashchange = async () => {
      this.setState(
        Object.assign({}, emptyState, {
          game_address: window.location.hash.replace("#", ""),
        })
      );
    };

    let mnemonic = localStorage.getItem("mnemonic");
    if (!mnemonic) {
      mnemonic = bip39.generateMnemonic();
      localStorage.setItem("mnemonic", mnemonic);
    }

    let tx_encryption_seed = localStorage.getItem("tx_encryption_seed");
    if (tx_encryption_seed) {
      tx_encryption_seed = Uint8Array.from(
        JSON.parse(`[${tx_encryption_seed}]`)
      );
    } else {
      tx_encryption_seed = SecretJS.EnigmaUtils.GenerateNewSeed();
      localStorage.setItem("tx_encryption_seed", tx_encryption_seed);
    }

    const signingPen = await SecretJS.Secp256k1Pen.fromMnemonic(mnemonic);
    const myWalletAddress = SecretJS.pubkeyToAddress(
      SecretJS.encodeSecp256k1Pubkey(signingPen.pubkey),
      "secret"
    );
    const secretJsClient = new SecretJS.SigningCosmWasmClient(
      "https://bootstrap.int.testnet.enigma.co",
      myWalletAddress,
      (signBytes) => signingPen.sign(signBytes),
      tx_encryption_seed,
      {
        init: {
          amount: [{ amount: "0", denom: "uscrt" }],
          gas: "500000",
        },
        exec: {
          amount: [{ amount: "0", denom: "uscrt" }],
          gas: "500000",
        },
      }
    );

    this.setState({ secretJsClient, myWalletAddress, mnemonic });

    const refreshAllRooms = async () => {
      if (window.location.hash !== "") {
        return;
      }

      try {
        const data = await secretJsClient.getContracts(codeId);

        this.setState({
          all_rooms: data,
        });
      } catch (e) {
        console.log("refreshAllRooms", e);
      }
    };
    setTimeout(refreshAllRooms, 0);
    setInterval(refreshAllRooms, 200);

    const refreshMyHand = async () => {
      if (window.location.hash === "") {
        return;
      }

      if (!this.state.player_a || !this.state.player_b) {
        return;
      }

      if (
        this.state.player_a !== this.state.myWalletAddress &&
        this.state.player_b !== this.state.myWalletAddress
      ) {
        return;
      }

      if (JSON.stringify(this.state.my_hand) !== JSON.stringify([{}, {}])) {
        // this should work because when switching room (= switching hash location)
        // we set an empty state
        return;
      }

      const secret = +localStorage.getItem(this.state.game_address);
      try {
        const data = await secretJsClient.queryContractSmart(
          this.state.game_address,
          { get_my_hand: { secret } }
        );

        this.setState({
          my_hand: data,
        });

        if (this.state.myWalletAddress === this.state.player_a) {
          this.setState({
            player_a_hand: this.state.my_hand,
          });
        } else if (this.state.myWalletAddress === this.state.player_b) {
          this.setState({
            player_b_hand: this.state.my_hand,
          });
        }
      } catch (e) {
        console.log("refreshMyHand", e);
      }
    };
    setTimeout(refreshMyHand, 0);
    setInterval(refreshMyHand, 200);

    const refreshMyWalletBalance = async () => {
      try {
        const data = await secretJsClient.getAccount(myWalletAddress);

        if (!data) {
          this.setState({
            myWalletBalance: (
              <span>
                (No funds - Go get some at{" "}
                <a
                  href="https://faucet.testnet.enigma.co"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  https://faucet.testnet.enigma.co
                </a>
                )
              </span>
            ),
          });
        } else {
          this.setState({
            myWalletBalance: `(${nf.format(
              +data.balance[0].amount / 1000000
            )} SCRT)`,
          });
        }
      } catch (e) {
        console.log("refreshMyWalletBalance", e);
      }
    };
    setTimeout(refreshMyWalletBalance, 0);
    setInterval(refreshMyWalletBalance, 2500);

    const refreshTableState = async () => {
      if (window.location.hash === "") {
        return;
      }

      if (this.state.stage.includes("Ended")) {
        return;
      }

      try {
        const data = await secretJsClient.queryContractSmart(
          this.state.game_address,
          { get_public_data: {} }
        );

        if (data.player_a_hand.length === 0) {
          data.player_a_hand = [{}, {}];
        }
        if (data.player_b_hand.length === 0) {
          data.player_b_hand = [{}, {}];
        }

        if (this.state.myWalletAddress === data.player_a) {
          this.setState({
            player_a_hand: this.state.my_hand,
            player_b_hand: data.player_b_hand,
          });
        } else if (this.state.myWalletAddress === data.player_b) {
          this.setState({
            player_a_hand: data.player_a_hand,
            player_b_hand: this.state.my_hand,
          });
        } else {
          this.setState({
            player_a_hand: data.player_a_hand,
            player_b_hand: data.player_b_hand,
          });
        }

        this.setState({
          community_cards: data.community_cards,
          player_a: data.player_a,
          player_a_bet: data.player_a_bet,
          player_a_wallet: data.player_a_wallet,
          player_b: data.player_b,
          player_b_bet: data.player_b_bet,
          player_b_wallet: data.player_b_wallet,
          stage: data.stage,
          starter: data.starter,
          turn: data.turn,
          last_play: data.last_play,
        });
      } catch (e) {
        console.log("refreshTableState", e);
      }
    };

    setTimeout(refreshTableState, 0);
    setInterval(refreshTableState, 200);
  }

  async createRoom() {
    this.setState({ createLoading: true });
    try {
      await this.state.secretJsClient.instantiate(
        codeId,
        {},
        this.state.new_room_name
      );
    } catch (e) {
      console.log("createRoom", e);
    }
    this.setState({ new_room_name: "", createLoading: false });
  }

  async joinRoom() {
    if (!this.state.game_address) {
      // ah?
      return;
    }

    this.setState({ joinLoading: true });

    let secret = +localStorage.getItem(this.state.game_address);
    if (!secret) {
      const seed = SecretJS.EnigmaUtils.GenerateNewSeed();
      secret = Buffer.from(seed.slice(0, 8)).readUInt32BE(0); // 64 bit
    }

    try {
      await this.state.secretJsClient.execute(this.state.game_address, {
        join: { secret },
      });
    } catch (e) {
      console.log("join", e);
    }

    localStorage.setItem(this.state.game_address, secret);

    this.setState({ joinLoading: false });
  }

  async fold() {
    this.setState({ foldLoading: true });
    try {
      await this.state.secretJsClient.execute(this.state.game_address, {
        fold: {},
      });
    } catch (e) {
      console.log("fold", e);
    }
    this.setState({ foldLoading: false });
  }

  async check() {
    this.setState({ checkLoading: true });
    try {
      await this.state.secretJsClient.execute(this.state.game_address, {
        check: {},
      });
    } catch (e) {
      console.log("check", e);
    }
    this.setState({ checkLoading: false });
  }

  async call() {
    this.setState({ callLoading: true });
    try {
      await this.state.secretJsClient.execute(this.state.game_address, {
        call: {},
      });
    } catch (e) {
      console.log("call", e);
    }
    this.setState({ callLoading: false });
  }

  async raise() {
    this.setState({ raiseLoading: true });
    try {
      await this.state.secretJsClient.execute(this.state.game_address, {
        raise: { amount: 10000 },
      });
    } catch (e) {
      console.log("raise", e);
    }
    this.setState({ raiseLoading: false });
  }

  getMe() {
    if (!this.state.myWalletAddress) {
      return null;
    }

    if (this.state.myWalletAddress === this.state.player_a) {
      return {
        player: "A",
        address: this.state.player_a,
        bet: this.state.player_a_bet,
        wallet: this.state.player_a_wallet,
      };
    }

    if (this.state.myWalletAddress === this.state.player_b) {
      return {
        player: "B",
        address: this.state.player_b,
        bet: this.state.player_b_bet,
        wallet: this.state.player_b_wallet,
      };
    }

    return null;
  }

  render() {
    if (window.location.hash === "") {
      return (
        <div style={{ color: "white" }}>
          <Table>
            {/* wallet */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                padding: 10,
              }}
            >
              <div>
                You: {this.state.myWalletAddress} {this.state.myWalletBalance}
              </div>
            </div>
            <center>
              <div>
                <Form.Input
                  placeholder="Room name"
                  value={this.state.new_room_name}
                  onChange={(_, { value }) =>
                    this.setState({ new_room_name: value })
                  }
                />
                <Button
                  loading={this.state.createLoading}
                  disabled={this.state.createLoading}
                  onClick={this.createRoom.bind(this)}
                >
                  Create!
                </Button>
              </div>
              <br />
              <div>All rooms</div>
              {this.state.all_rooms.map((r, i) => (
                <div key={i}>
                  {r.label}: <a href={"#" + r.address}>{r.address}</a>
                </div>
              ))}
            </center>
          </Table>
        </div>
      );
    }

    let stage = this.state.stage;
    if (stage.includes("EndedWinner")) {
      stage = stage.replace("EndedWinner", "");
      stage = `Player ${stage} Wins!`;
    } else if (stage.includes("EndedDraw")) {
      stage = "It's a Tie!";
    } else if (stage === "WaitingForPlayersToJoin") {
      stage = (
        <span>
          <div>Waiting for players</div>
          <Button
            loading={this.state.joinLoading}
            disabled={
              this.state.joinLoading ||
              this.getMe() ||
              !this.state.myWalletBalance.includes("SCRT")
            }
            onClick={this.joinRoom.bind(this)}
          >
            Join
          </Button>
        </span>
      );
    } else if (stage) {
      stage += " betting round";
    }

    let turn = "Player A";
    let turnDirection = "->";
    let lastPlay = `Last play: ${this.state.last_play}`;
    if (this.state.turn === this.state.player_b) {
      turn = "Player B";
      turnDirection = "<-";
    }
    turn = "Turn: " + turn;
    if (
      !this.state.stage ||
      this.state.stage.includes("Ended") ||
      this.state.stage.includes("Waiting")
    ) {
      turn = "";
      turnDirection = "";
      lastPlay = "";
    }
    if (!this.state.turn) {
      turn = "";
      turnDirection = "";
      lastPlay = "";
    }

    let room = "";
    if (this.state.game_address) {
      room = "Room: " + this.state.game_address;
    }

    return (
      <div style={{ color: "white" }}>
        <Table>
          {/* wallet */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              padding: 10,
            }}
          >
            <div>
              You: {this.state.myWalletAddress} {this.state.myWalletBalance}
            </div>
          </div>
          {/* return to loby */}
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              padding: 10,
            }}
          >
            <a href="/#">Return to loby</a>
          </div>
          {/* community cards */}
          <div
            style={{ position: "absolute", width: "100%", textAlign: "center" }}
          >
            <center>
              <div>{room}</div>
              <div>{stage}</div>
              <div>{lastPlay}</div>
              <div>{turn}</div>
              <div>{turnDirection}</div>
            </center>

            <br />
            {this.state.community_cards.map((c, i) =>
              stateCardToReactCard(c, true, i)
            )}
            <center>
              <div style={{ padding: 35 }}>
                <span style={{ marginRight: 250 }}>
                  A Total Bet: {nf.format(this.state.player_b_bet)}
                </span>
                <span>B Total Bet: {nf.format(this.state.player_a_bet)}</span>
              </div>
            </center>
          </div>
          {/* player a */}
          <center>
            <div
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                padding: 10,
              }}
            >
              <div>
                Player A
                {this.state.player_a === this.state.myWalletAddress
                  ? " (You)"
                  : ""}
              </div>
              <div>Credits left: {nf.format(this.state.player_a_wallet)}</div>
              <div>{this.state.player_a}</div>
            </div>
          </center>
          <Hand
            style={{ position: "absolute", right: "35vw" }}
            cards={this.state.player_a_hand.map((c) => stateCardToReactCard(c))}
          />
          {/* controls */}
          <center>
            <div
              style={{
                position: "fixed",
                bottom: 0,
                padding: 10,
                width: "100%",
                textAlign: "center",
              }}
              hidden={!this.getMe()}
            >
              <Button
                loading={this.state.checkLoading}
                onClick={this.check.bind(this)}
                disabled={
                  this.state.player_a_bet !== this.state.player_b_bet ||
                  !this.state.turn ||
                  this.state.turn !== this.state.myWalletAddress ||
                  this.state.stage.includes("Ended") ||
                  this.state.stage.includes("Waiting") ||
                  this.state.callLoading ||
                  this.state.raiseLoading ||
                  this.state.foldLoading ||
                  this.state.checkLoading
                }
              >
                Check
              </Button>
              <Button
                loading={this.state.callLoading}
                onClick={this.call.bind(this)}
                disabled={
                  this.state.player_a_bet === this.state.player_b_bet ||
                  !this.state.turn ||
                  this.state.turn !== this.state.myWalletAddress ||
                  this.state.stage.includes("Ended") ||
                  this.state.stage.includes("Waiting") ||
                  this.state.callLoading ||
                  this.state.raiseLoading ||
                  this.state.foldLoading ||
                  this.state.checkLoading
                }
              >
                Call
              </Button>
              <Button
                loading={this.state.raiseLoading}
                onClick={this.raise.bind(this)}
                disabled={
                  !this.state.turn ||
                  this.state.turn !== this.state.myWalletAddress ||
                  this.state.stage.includes("Ended") ||
                  this.state.stage.includes("Waiting") ||
                  this.state.callLoading ||
                  this.state.raiseLoading ||
                  this.state.foldLoading ||
                  this.state.checkLoading
                }
              >
                Raise
              </Button>
              <Button
                loading={this.state.foldLoading}
                onClick={this.fold.bind(this)}
                disabled={
                  !this.state.turn ||
                  this.state.turn !== this.state.myWalletAddress ||
                  this.state.stage.includes("Ended") ||
                  this.state.stage.includes("Waiting") ||
                  this.state.callLoading ||
                  this.state.raiseLoading ||
                  this.state.foldLoading ||
                  this.state.checkLoading
                }
              >
                Fold
              </Button>
              <Slider
                value={10000}
                color="red"
                settings={{
                  start: 2,
                  min: 0,
                  max: 10,
                  step: 1,
                  onChange: (value) => {
                    this.setState({ raiseAmount: value });
                  },
                }}
              />
            </div>
          </center>
          {/* player b */}
          <center>
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                padding: 10,
              }}
            >
              <div>
                Player B{" "}
                {this.state.player_b === this.state.myWalletAddress
                  ? " (You)"
                  : ""}
              </div>
              <div>Credits left: {nf.format(this.state.player_b_wallet)}</div>
              <div>{this.state.player_b}</div>
            </div>
          </center>

          <Hand
            style={{ position: "absolute", left: "23vw" }}
            cards={this.state.player_b_hand.map((c) => stateCardToReactCard(c))}
          />
        </Table>
      </div>
    );
  }
}

function stateCardToReactCard(c, component = false, index) {
  let suit = c.suit;
  let value = c.value;

  if (!c.value || !c.suit) {
    if (component) {
      return <Card key={index} />;
    } else {
      return {};
    }
  }

  suit = suit[0];
  let face;
  if (value === "Two") {
    face = "2";
  } else if (value === "Three") {
    face = "3";
  } else if (value === "Four") {
    face = "4";
  } else if (value === "Five") {
    face = "5";
  } else if (value === "Six") {
    face = "6";
  } else if (value === "Seven") {
    face = "7";
  } else if (value === "Eight") {
    face = "8";
  } else if (value === "Nine") {
    face = "9";
  } else {
    face = value[0];
  }

  if (component) {
    return <Card key={index} face={face} suit={suit} />;
  } else {
    return { face, suit };
  }
}

export default App;