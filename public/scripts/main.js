var rhit = rhit || {};

rhit.FB_COLLECTION_ACTIVITIES = "activities";
rhit.FB_KEY_TYPE = "type"
rhit.FB_KEY_PRICE = "price"
rhit.FB_KEY_PARTICPANTS = "participants"

rhit.FbActivitiesManager = class {
	constructor() {
		this._ref = firebase.firestore().collection(rhit.FB_COLLECTION_ACTIVITIES);
	}

	getRandomActivity(type, price, participants) {
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
			if (possibleSnapshots.length < 1) {
				return
			}
			return possibleSnapshots[Math.floor(Math.random() * possibleSnapshots.length)]
		}).catch(function(error) {
			console.log("Error getting documents: ", error);
		});
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

			const randomActivity = rhit.fbActivitiesManager.getRandomActivity(type, price, participants)
			if (!randomActivity) {
				alert("No activity could be found! Try a broader search")
				return;
			}
			window.location.href = `/activity.html?id=${randomActivity}`
		}
	}
}

rhit.main = function () {
	console.log("Ready");
	if (document.getElementById("home-page")) {
		rhit.fbActivitiesManager = new rhit.FbActivitiesManager()
		new rhit.HomePageController();
	}
	
};

rhit.main();
