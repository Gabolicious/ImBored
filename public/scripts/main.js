var rhit = rhit || {};

rhit.FB_COLLECTION_ACTIVITIES = "activities";
rhit.FB_COLLECTION_HISTORY = "historys"
rhit.FB_KEY_HISTORY = "history"
rhit.FB_KEY_TYPE = "type"
rhit.FB_KEY_PRICE = "price"
rhit.FB_KEY_PARTICPANTS = "participants"
rhit.FB_KEY_ACTIVITY = "activity"
rhit.FB_KEY_AVAILABILITY = "availability"

rhit.fbProfileManager = null;
// From: https://stackoverflow.com/questions/494143/creating-a-new-dom-element-from-an-html-string-using-built-in-dom-methods-or-pro/35385518#35385518
/**
 * @param {String} HTML representing a single element
 * @return {Element}
 */
function htmlToElement(html) {
    var template = document.createElement('template');
    html = html.trim();
    template.innerHTML = html;
    return template.content.firstChild;
};

rhit.FbProfileManager = class {
	constructor() {
		this._user = null;
		this.creatingAccount = false;
		this._historySnapshot = null;
		this._historyRef = null;
	}
	beginListening(changeListener) {
		firebase.auth().onAuthStateChanged((user) => {
			this._user = user;
			if (this._user) {
				this._historyRef = firebase.firestore().collection(rhit.FB_COLLECTION_HISTORY).doc(this._user.uid)
				this._historyRef.get().then((docSnap) => {
					if (!docSnap.exists) {
						this._historyRef.set({
							[rhit.FB_KEY_HISTORY]: []
						}).catch((err) => {
							console.log(err);
							alert("Unable to instantiate the user.")
						})
					}
				})
			} else {
				this._historyRef = null;
			}
			changeListener();
		})
	}

	beginHistoryListening(changeListener) {
		this._historyRef.onSnapshot((docSnapshot) => {
			this._historySnapshot = docSnapshot.get(rhit.FB_KEY_HISTORY);

			if (changeListener) {
				changeListener();
			}
		})
	}

	updateUsername(name) {
		return this._user.updateProfile({
			displayName: name
		})
	}
	createAccount(email, password, name) {
		return new Promise((resolve, reject) => {
			this.creatingAccount = true;

			firebase.auth().createUserWithEmailAndPassword(email, password).then((userCredentials) => {
				const user = userCredentials.user
				user.updateProfile({
					displayName: name
				}).then(() => {
					this.creatingAccount = false;
					resolve()
				}).catch((error) => {
					this.creatingAccount = false;
					reject(error)
				});
			}).catch((error) => {
				this.creatingAccount = false;
				reject(error)
			});
		})

	}
	signIn(email, password) {
		console.log(`login for email: ${email} password: ${password}`);

		return firebase.auth().signInWithEmailAndPassword(email, password);
	}
	signOut() {
		return firebase.auth().signOut();
	}

	deleteAccount(password) {
		return new Promise((resolve, reject) => {
			this._user.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(
				this._user.email,
				password
			)).then(() => {
				this._user.delete().then(() => {
					resolve()
				}).catch((err) => {
					reject(err)
				})
			}).catch((err) => {
				reject(err)
			})
		})
	}

	addToHistory(activityID) {
		return new Promise((resolve, reject) => {
			if (!this.isSignedIn) {
				resolve();
				return;
			}
			this._historyRef.update({
				[rhit.FB_KEY_HISTORY]: firebase.firestore.FieldValue.arrayUnion(activityID)
			}).then(() => {
				resolve();
			}).catch((err) => {
				reject(err)
			})
		})
	}

	get isSignedIn() {
		return !!this._user;
	}
	get uid() {
		return this._user.uid
	}
	get name() {
		return this._user.displayName
	}

	get historyLength() {
		if (!this._historySnapshot) return 0
		return this._historySnapshot.length;
	}

	historyIDAtIndex(index) {
		const historyID = this._historySnapshot[index]
		if (!historyID) throw new Error("Index out of bounds")
		return historyID
	}
}

rhit.ProfilePageController = class {
	constructor() {
		document.getElementById("submit-new-name").onclick = (event) => {
			const newName = document.getElementById("new-name-field").value;
			if (!newName) {
				alert("Please provide a valid new name")
				return;
			}

			rhit.fbProfileManager.updateUsername(newName).then(() => {
				this.updateView();
			}).catch((err) => {
				console.log("Error", err);
				alert("Error changing username")
			})
		}

		document.getElementById("delete-account-button").onclick = (event) => {
			const pwd = document.getElementById("delete-password-field").value;
			if (!pwd) {
				alert("Please provide a password")
				return;
			}
			rhit.fbProfileManager.deleteAccount(pwd).catch((err) => {
				console.error(err)
				alert("Error deleting your account!")
			})
		}

		rhit.fbProfileManager.beginHistoryListening(this.updateView.bind(this))

		this.updateView();
	}

	updateView() {
		if (rhit.fbProfileManager.isSignedIn) {
			document.getElementById("profile-name").innerHTML = rhit.fbProfileManager.name;
			document.getElementById("new-name-field").value = ""
			document.getElementById("logout-button").onclick = (event) => {
				rhit.fbProfileManager.signOut();
			}
			document.getElementById("profile-dropdown").style.display = ""
		} else {
			window.location.href = "./index.html"
		}

		if (rhit.fbProfileManager.historyLength < 1) {
			document.getElementById("history-container").style.display = "none"
		} else {
			for (let i = 0; i < rhit.fbProfileManager.historyLength; i++) {
				new rhit.FbActivityManager(rhit.fbProfileManager.historyIDAtIndex(i)).get().then((doc) => {
					if (doc.exists) {
						console.log(doc.data());
						document.getElementById("history-container").appendChild(this._createHistoryCard(doc.data()))
					}
				}).catch ((err) => {
					console.error(err)
				})
			}
			document.getElementById("history-container").style.display = ""
		}
	}	

	_createHistoryCard(history) {
		return htmlToElement(`<div class="mb-4">
		<div class="row ml-3">
			<div class="col-7">
				<p class="h4"><strong>${history.activity}</strong></p>
			</div>
			<!--
			<div class="col-5 mt-1">
				<span class="fa fa-star checked"></span>
				<span class="fa fa-star checked"></span>
				<span class="fa fa-star checked"></span>
				<span class="fa fa-star"></span>
				<span class="fa fa-star"></span>
			</div>
			-->
		</div>
	</div>`)
	}
}

rhit.LoginPageController = class {
	constructor() {
		if (rhit.fbProfileManager.isSignedIn) window.location.href = "./index.html"

		$("#createAccountModal").on("show.bs.modal", (e) => {
			document.getElementById("create-email-field").value = document.getElementById("login-email-field").value;
		})

		document.getElementById("login-button").onclick = (event) => {
			const email = document.getElementById("login-email-field").value;
			const password = document.getElementById("login-password-field").value;

			if (!email) {
				alert("Please enter an email")
				return;
			}
			if (!password) {
				alert("Please enter a password")
				return;
			}
			rhit.fbProfileManager.signIn(email, password).then(() => {
				window.location.href = "./index.html"
			}).catch((error) => {
				const errorCode = error.code;
				const errorMessage = error.message

				console.log("Existing account log in error", errorCode, errorMessage);
				alert("Unable to log you in. Is your username and password correct?")
			});
		}

		document.getElementById("create-account-button").onclick = (event) => {
			const username = document.getElementById("create-username-field").value;
			const email = document.getElementById("create-email-field").value;
			const password1 = document.getElementById("create-password-field").value;
			const password2 = document.getElementById("create-second-password-field").value;

			if (password1 !== password2) {
				alert("Passwords do not match!")
				return;
			}

			if (!password1 || !password2) {
				alert("A password is required")
				return;
			}

			if (!email) {
				alert("Please enter a valid email.")
				return;
			}

			if (!username) {
				alert("Please enter a valid username")
				return;
			}

			rhit.fbProfileManager.createAccount(email, password1, username).then(() => {
				window.location.href = "./index.html"
			}).catch((error) => {
				console.log("error creating account", error);
				alert("There was an error creating your account")
			})
		}
	}
}

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

	get() {
		return this._ref.get()
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
		if (rhit.fbProfileManager.isSignedIn) {
			document.getElementById("login-button").style.display = "none"
			document.getElementById("profile-name").innerHTML = rhit.fbProfileManager.name;
			document.getElementById("logout-button").onclick = (event) => {
				rhit.fbProfileManager.signOut();
			}
			document.getElementById("profile-dropdown").style.display = ""
		} else {
			document.getElementById("profile-dropdown").style.display = "none"
			document.getElementById("login-button").style.display = ""
		}
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
				const activityID = possibleSnapshots[Math.floor(Math.random() * possibleSnapshots.length)];
				rhit.fbProfileManager.addToHistory(activityID).then(() => {
					resolve(activityID)
				}).catch((err) => {
					console.log(err);
					reject("Error adding activity to history!")
				})
			}).catch(function (error) {
				console.log("Error with firestore ", error);
				reject("Error getting an activity")
			});
		})
	}
}

rhit.HomePageController = class {
	constructor() {
		if (rhit.fbProfileManager.isSignedIn) {
			document.getElementById("login-button").style.display = "none"
			document.getElementById("profile-name").innerHTML = rhit.fbProfileManager.name;
			document.getElementById("logout-button").onclick = (event) => {
				rhit.fbProfileManager.signOut();
			}
			document.getElementById("profile-dropdown").style.display = ""
		} else {
			document.getElementById("profile-dropdown").style.display = "none"
			document.getElementById("login-button").style.display = ""
		}
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
	rhit.fbProfileManager = new rhit.FbProfileManager()
	rhit.fbProfileManager.beginListening(() => {
		if (rhit.fbProfileManager.creatingAccount) return;
		console.log("isSignedIn = ", rhit.fbProfileManager.isSignedIn);
		if (document.getElementById("home-page")) {
			rhit.fbActivitiesManager = new rhit.FbActivitiesManager()
			new rhit.HomePageController();
		} else if (document.getElementById("activity-page")) {
			rhit.fbActivityManager = new rhit.FbActivityManager(urlParams.get("id"))
			new rhit.ActivityPageController();
		} else if (document.getElementById("login-page")) {
			new rhit.LoginPageController();
		} else if (document.getElementById("profile-page")) {
			new rhit.ProfilePageController();
		}
	})
};

rhit.main();