var rhit = rhit || {};

rhit.FB_COLLECTION_ACTIVITIES = "activities";
rhit.FB_KEY_TYPE = "type"
rhit.FB_KEY_PRICE = "price"
rhit.FB_KEY_PARTICPANTS = "participants"
rhit.FB_KEY_ACTIVITY = "activity"
rhit.FB_KEY_AVAILABILITY = "availability"

rhit.FbActivityManager = class {
	constructor(id) {
		this._documentSnapshot = {};
		this._unsubscribe = null;
		this._ref = firebase.firestore().collection(rhit.FB_COLLECTION_ACTIVITIES).doc(id)
	}
	beginListening(changeListener) {
		this._unsubscribe = this._ref.onSnapshot((doc) => {
			if (doc.exists) {
				this._documentSnapshot = doc;
				console.log(doc.data());
			} else {
				console.log("No such document!");
			}
			changeListener()
		})
	}
	stopListening() {
		this._unsubscribe();
	}

	get activity() {
		return this._documentSnapshot.get(rhit.FB_KEY_ACTIVITY)
	}

	get type() {
		return this._documentSnapshot.get(rhit.FB_KEY_TYPE)
	}

	get price() {
		return this._documentSnapshot.get(rhit.FB_KEY_PRICE)
	}

	get participants() {
		return this._documentSnapshot.get(rhit.FB_KEY_PARTICPANTS)
	}

	get availability() {
		return this._documentSnapshot.get(rhit.FB_KEY_AVAILABILITY)
	}
}

rhit.ActivityPageController = class {
	constructor() {
		rhit.fbActivityManager.beginListening(this.updateView.bind(this))
	}

	updateView() {
		document.getElementById("activity-title").innerHTML = rhit.fbActivityManager.activity;
		document.getElementById("type").innerHTML = `Type: ${rhit.fbActivityManager.type}`
		document.getElementById("participants").innerHTML = `Participants: ${rhit.fbActivityManager.participants}`
		document.getElementById("price-slider").value = rhit.fbActivityManager.price;
		document.getElementById("access-slider").value = rhit.fbActivityManager.availability;

	}
}

rhit.FbActivitiesManager = class {
	constructor() {
		this._ref = firebase.firestore().collection(rhit.FB_COLLECTION_ACTIVITIES);
	}

	getRandomActivity(type, price, participants) {
		return new Promise((resolve, reject) => {
			console.log('type :>> ', type);
			console.log('price :>> ', price);
			console.log('participants :>> ', participants);
			let query = this._ref.where(rhit.FB_KEY_PRICE, "<=", price)
			//query = query.where(rhit.FB_KEY_PARTICPANTS, ">=", participants)
			if (type != "any") {
				query = query.where(rhit.FB_KEY_TYPE, "==", type)
			}

			query.get().then((querySnapshots) => {
				const possibleSnapshots = []
				querySnapshots.forEach(doc => {
					if (doc.data()[rhit.FB_KEY_PARTICPANTS] >= participants) possibleSnapshots.push(doc.id)
				});
				console.log(possibleSnapshots);
				if (possibleSnapshots.length < 1) {
					reject("No activity could be found! Try a broader search")
				}
				resolve(possibleSnapshots[Math.floor(Math.random() * possibleSnapshots.length)])
			}).catch(function (error) {
				console.log("Error with firestore ", error);
				reject("Error getting an activity")
			});
		})
	}
}

rhit.HomePageController = class {
	constructor() {
		const validTypes = ["any", "education", "recreational", "social", "diy", "charity", "cooking", "relaxation", "music", "busywork"]
		document.getElementById("activity-button").onclick = (event) => {
			const type = document.getElementById("type-select").value.toLowerCase();
			const price = parseFloat(document.getElementById("price-slider").value);
			const participants = parseInt(document.getElementById("participant-input").value);

			if (participants < 1) {
				alert("Please select a valid number of participants")
				return;
			}
			if (price < 0 || price > 1) {
				alert("Please select a valid price")
				return;
			}
			if (!validTypes.includes(type)) {
				alert("Please select a valid type")
				return;
			}

			rhit.fbActivitiesManager.getRandomActivity(type, price, participants).then((randomActivity) => {
				window.location.href = `/activity.html?id=${randomActivity}`
			}).catch((error) => {
				alert(error)
			})
		}
	}
}

rhit.main = function () {
	console.log("Ready");
	const urlParams = new URLSearchParams(window.location.search)
	if (document.getElementById("home-page")) {
		rhit.fbActivitiesManager = new rhit.FbActivitiesManager()
		new rhit.HomePageController();
	} else if (document.getElementById("activity-page")) {
		rhit.fbActivityManager = new rhit.FbActivityManager(urlParams.get("id"))
		new rhit.ActivityPageController()
	}

};

rhit.main();