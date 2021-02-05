var rhit = rhit || {};

rhit.FB_COLLECTION_ACTIVITIES = "activities"
rhit.FB_COLLECTION_HISTORY = "historys"
rhit.FB_COLLECTION_REVIEWS = "reviews"
rhit.FB_COLLECTION_USERS = "users"
rhit.FB_KEY_HISTORY = "history"
rhit.FB_KEY_TYPE = "type"
rhit.FB_KEY_PRICE = "price"
rhit.FB_KEY_PARTICPANTS = "participants"
rhit.FB_KEY_ACTIVITY = "activity"
rhit.FB_KEY_AVAILABILITY = "availability"
rhit.FB_KEY_AUTHOR = "author"
rhit.FB_KEY_REVIEW_ACTIVITY = "activity"
rhit.FB_KEY_REVIEW_AUTHOR = "author"
rhit.FB_KEY_REVIEW_TEXT = "text"
rhit.FB_KEY_REVIEW_VALUE = "value"
rhit.FB_KEY_NAME = "name"

rhit.validTypes = ["any", "education", "recreational", "social", "diy", "charity", "cooking", "relaxation", "music", "busywork"]

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
		this._historySnapshot = null;
		this._createdSnapshots = null;
		this._reviewSnapshots = null;
		this._historyRef = null;
		this._activityRef = firebase.firestore().collection(rhit.FB_COLLECTION_ACTIVITIES);
		this.displayName = null;
		this._userRef = null;
		this.creatingAccount = false;
		this._reviewRef = firebase.firestore().collection(rhit.FB_COLLECTION_REVIEWS)
	}
	beginListening(changeListener) {
		firebase.auth().onAuthStateChanged((user) => {
			this._user = user;
			if (this._user) {
				this._historyRef = firebase.firestore().collection(rhit.FB_COLLECTION_HISTORY).doc(this._user.uid)
				let gotHistory = false;
				let gotName = false;
				this._historyRef.get().then((docSnap) => {
					if (!docSnap.exists) {
						this._historyRef.set({
							[rhit.FB_KEY_HISTORY]: []
						}).catch((err) => {
							console.log(err);
							alert("Unable to instantiate the user.")
						})
					}
					gotHistory = true;
					if (gotName) {
						changeListener()
					}
				})
				this._userRef = firebase.firestore().collection(rhit.FB_COLLECTION_USERS).doc(this._user.uid);
				this._userRef.get().then((docSnap) => {
					this.displayName = docSnap.get(rhit.FB_KEY_NAME)
					gotName = true;
					if (gotHistory) {
						changeListener()
					}
				})
			} else {
				this._historyRef = null;
				this._userRef = null;
				changeListener();
			}
		})
	}

	beginCreatedListening(changeListener) {
		this._activityRef.where(rhit.FB_KEY_AUTHOR, "==", this.uid).onSnapshot((docSnapshots) => {
			this._createdSnapshots = docSnapshots.docs;

			if (changeListener) {
				changeListener()
			}
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

	beginReviewListening(changeListener) {
		this._reviewRef.where(rhit.FB_KEY_REVIEW_AUTHOR, "==", this.uid).onSnapshot((docSnapshots) => {
			this._reviewSnapshots = docSnapshots.docs;

			if (changeListener) {
				changeListener()
			}
		})
	}

	updateUsername(name) {
		return this._userRef.set({
			[rhit.FB_KEY_NAME]: name
		})
	}
	createAccount(email, password, name) {
		return new Promise((resolve, reject) => {
			this.creatingAccount = true;
			firebase.auth().createUserWithEmailAndPassword(email, password).then((userCredentials) => {
				const user = userCredentials.user
				firebase.firestore().collection(rhit.FB_COLLECTION_USERS).doc(user.uid).set({
					[rhit.FB_KEY_NAME]: name
				}).then(() => {
					this._userRef = firebase.firestore().collection(rhit.FB_COLLECTION_USERS).doc(user.uid);
					this.displayName = name;
					this.creatingAccount = false;
					resolve()
				}).catch((err) => {
					this.creatingAccount = false;
					reject(err)
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

	createActivity(name, type, price, participants) {
		return new Promise((resolve, reject) => {
			if (!this.isSignedIn) {
				reject("You are not signed in!")
				return;
			}
			this._activityRef.add({
				[rhit.FB_KEY_ACTIVITY]: name,
				[rhit.FB_KEY_TYPE]: type,
				[rhit.FB_KEY_PRICE]: price,
				[rhit.FB_KEY_PARTICPANTS]: participants,
				[rhit.FB_KEY_AUTHOR]: this.uid
			}).then((docRef) => {
				resolve(docRef)
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
		return this.displayName
	}

	get createdLength() {
		if (!this._createdSnapshots) return 0;
		return this._createdSnapshots.length;
	}

	createdIDAtIndex(index) {
		const createdID = this._createdSnapshots[index];
		if (!createdID) throw new Error("Index out of bounds")
		return createdID.id
	}

	get historyLength() {
		if (!this._historySnapshot) return 0
		return this._historySnapshot.length;
	}

	historyIDAtIndex(index) {
		const historyRef = this._historySnapshot[index]
		if (!historyRef) throw new Error("Index out of bounds")
		return historyRef
	}

	get reviewLength() {
		if (!this._reviewSnapshots) return 0;
		return this._reviewSnapshots.length;
	}

	reviewIDAtIndex(index) {
		const reviewID = this._reviewSnapshots[index]
		if (!reviewID) throw new Error("Index out of bounds")
		return reviewID.id
	}
}

rhit.ReviewPageController = class {
	constructor(uid) {
		if (!uid) {
			window.location.href = "./index.html"
			return;
		}
		this._activity = new rhit.FbActivityManager(uid);
		this.reviewValue = 5;
		document.getElementById("1-star").onclick = () => {
			this._updateReviewStars(1)
		}
		document.getElementById("2-star").onclick = () => {
			this._updateReviewStars(2)
		}
		document.getElementById("3-star").onclick = () => {
			this._updateReviewStars(3)
		}
		document.getElementById("4-star").onclick = () => {
			this._updateReviewStars(4)
		}
		document.getElementById("5-star").onclick = () => {
			this._updateReviewStars(5)
		}

		document.getElementById("submit-button").onclick = () => {
			const reviewText = document.getElementById("review-text").value || "";
			reviewText.replace(/\r?\n|\r/g, "")

			if (!this.reviewValue || this.reviewValue < 1 || this.reviewValue > 5) {
				alert("Please provide a valid rating")
				return;
			}

			this._activity.addReview(this.reviewValue, reviewText).then((reviewRef) => {
				window.location.href = `./activity.html?id=${this._activity.id}`
			}).catch((err) => {
				console.log("Error", err);
				alert("There was an error adding the review!")
			})
		}

		this._activity.beginListening(this.updateView.bind(this))
	}

	updateView() {
		this._activity.hasUserReviewed().then((reviewed) => {
			if (reviewed) {
				window.location.href = "./index.html"
			}
		}).catch((err) => {
			console.log("error", err);
		})
		document.getElementById("review-title").innerHTML = this._activity.activity
	}

	_updateReviewStars(val) {
		this.reviewValue = val;
		const oneStar = document.getElementById("1-star")
		const twoStar = document.getElementById("2-star")
		const threeStar = document.getElementById("3-star")
		const fourStar = document.getElementById("4-star")
		const fiveStar = document.getElementById("5-star")
		oneStar.classList.remove("checked")
		twoStar.classList.remove("checked")
		threeStar.classList.remove("checked")
		fourStar.classList.remove("checked")
		fiveStar.classList.remove("checked")

		switch (val) {
			case 5:
				fiveStar.classList.add("checked")
			case 4:
				fourStar.classList.add("checked")
			case 3:
				threeStar.classList.add("checked")
			case 2:
				twoStar.classList.add("checked")
			case 1:
				oneStar.classList.add("checked")

		}
	}
}

rhit.CreatePageController = class {
	constructor() {
		if (rhit.fbProfileManager.isSignedIn) {
			document.getElementById("login-button").style.display = "none"
			document.getElementById("profile-name").innerHTML = rhit.fbProfileManager.name;
			document.getElementById("logout-button").onclick = (event) => {
				rhit.fbProfileManager.signOut();
			}
			document.getElementById("profile-dropdown").style.display = ""
		} else {
			window.location.href = "./"
		}

		document.getElementById("create-button").onclick = (event) => {
			const name = document.getElementById("new-activity-name-field").value;
			const type = document.getElementById("type-select").value;
			const price = parseFloat(document.getElementById("price-slider").value);
			const participants = parseInt(document.getElementById("participant-input").value);

			if (!name) {
				alert("Please provide a name")
				return;
			}
			if (!type || !rhit.validTypes.includes(type)) {
				alert("Please provide a valid type")
				return;
			}
			if (!price || price < 0 || price > 1) {
				alert("Please provide a valid price")
				return;
			}
			if (!participants || participants < 1) {
				alert("Please provide a valid number of participants")
				return;
			}

			rhit.fbProfileManager.createActivity(name, type, price, participants).then((docRef) => {
				window.location.href = `./activity.html?id=${docRef.id}`
			}).catch((err) => {
				console.log("Error", err);
				alert("There was an error creating the activity, are you signed in?")
			})
		}
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

		rhit.fbProfileManager.beginHistoryListening(this.updateHistory.bind(this))
		rhit.fbProfileManager.beginCreatedListening(this.updateCreated.bind(this))
		rhit.fbProfileManager.beginReviewListening(this.updateReviews.bind(this))
		this.updateView();
	}

	updateReviews() {
		if (rhit.fbProfileManager.reviewLength < 1) {
			document.getElementById("reviews-container").style.display = "none"
		} else {
			document.getElementById("reviews-container").innerHTML = `<hr>
            <div class="row ml-1">
                <h2 class="mt-2"><strong>Reviews:</strong></h2>
            </div>`
			for (let i = 0; i < rhit.fbProfileManager.reviewLength; i++) {
				new rhit.FbReviewManager(rhit.fbProfileManager.reviewIDAtIndex(i)).get().then((review) => {
					document.getElementById("reviews-container").appendChild(this._createReviewCard(review))
				}).catch((err) => {
					console.error(err)
				})
			}
			document.getElementById("reviews-container").style.display = ""
		}
	}

	updateHistory() {
		if (rhit.fbProfileManager.historyLength < 1) {
			document.getElementById("history-container").style.display = "none"
		} else {
			document.getElementById("history-container").innerHTML = `<hr>
            <div class="row ml-1">
                <h2 class="mt-2"><strong>History:</strong></h2>
            </div>`
			for (let i = 0; i < rhit.fbProfileManager.historyLength; i++) {
				new rhit.FbActivityManager(rhit.fbProfileManager.historyIDAtIndex(i)).get().then((history) => {
					console.log(history);
					history.id = rhit.fbProfileManager.historyIDAtIndex(i)
					document.getElementById("history-container").appendChild(this._createHistoryCard(history))

				}).catch((err) => {
					console.error(err)
				})
			}
			document.getElementById("history-container").style.display = ""
		}
	}

	updateCreated() {
		if (rhit.fbProfileManager.createdLength < 1) {
			document.getElementById("activities-container").style.display = "none"
		} else {
			document.getElementById("activities-container").innerHTML = `<hr>
            <div class="row ml-1">
                <h2 class="mt-2"><strong>Your Activities:</strong></h2>
            </div>`
			for (let i = 0; i < rhit.fbProfileManager.createdLength; i++) {
				new rhit.FbActivityManager(rhit.fbProfileManager.createdIDAtIndex(i)).get().then((created) => {
					console.log(created);
					created.id = rhit.fbProfileManager.createdIDAtIndex(i)
					document.getElementById("activities-container").appendChild(this._createCreatedCard(created))

				})
			}
			document.getElementById("activities-container").style.display = ""
		}
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
	}

	_createHistoryCard(history) {
		return htmlToElement(`<div class="mb-4">
		<div class="row ml-3">
			<div class="col-7">
				<a class="h4" href="/activity.html?id=${history.id}"><strong>${history.activity}</strong></a>
			</div>
			<div class="col-5 mt-1">
				<span class="fa fa-star ${history.rating >= 1 ? "checked" : ""}"></span>
				<span class="fa fa-star ${history.rating >= 2 ? "checked" : ""}"></span>
				<span class="fa fa-star ${history.rating >= 3 ? "checked" : ""}"></span>
				<span class="fa fa-star ${history.rating >= 4 ? "checked" : ""}"></span>
				<span class="fa fa-star ${history.rating >= 5 ? "checked" : ""}"></span>
			</div>
		</div>
	</div>`)
	}

	_createCreatedCard(created) {
		return htmlToElement(`<div class="mb-4">
		<div class="row ml-3">
			<div class="col-7">
				<a class="h4" href="./activity.html?id=${created.id}"><strong>${created.activity}</strong></a>
			</div>
			<div class="col-5 mt-1">
				<span class="fa fa-star ${created.rating >= 1 ? "checked" : ""}"></span>
				<span class="fa fa-star ${created.rating >= 1 ? "checked" : ""}"></span>
				<span class="fa fa-star ${created.rating >= 1 ? "checked" : ""}"></span>
				<span class="fa fa-star ${created.rating >= 1 ? "checked" : ""}"></span>
				<span class="fa fa-star ${created.rating >= 1 ? "checked" : ""}"></span>
			</div>
		</div>
	</div>`)
	}

	_createReviewCard(review) {
		return htmlToElement(`<div class="mb-4">
		<div class="row ml-3">
			<div class="col-7">
				<a class="h4" href="./activity.html?id=${review.activityID}"><strong>${review.activity}</strong></a>
			</div>
			<div class="col-5 mt-1">
				<span class="fa fa-star ${review.stars >= 1 ? "checked" : ""}"></span>
				<span class="fa fa-star ${review.stars >= 2 ? "checked" : ""}"></span>
				<span class="fa fa-star ${review.stars >= 3 ? "checked" : ""}"></span>
				<span class="fa fa-star ${review.stars >= 4 ? "checked" : ""}"></span>
				<span class="fa fa-star ${review.stars >= 5 ? "checked" : ""}"></span>
			</div>
		</div>
		<div class="row">
			<p class="ml-5">${review.text}</p>
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

rhit.FbReviewManager = class {
	constructor(reviewID) {
		this._review = {}
		this._reviewRef = firebase.firestore().collection(rhit.FB_COLLECTION_REVIEWS).doc(reviewID)
	}
	get() {
		return new Promise((resolve, reject) => {
			this._reviewRef.get().then((reviewDoc) => {
				this._review.value = reviewDoc.get(rhit.FB_KEY_REVIEW_VALUE)
				this._review.text = reviewDoc.get(rhit.FB_KEY_REVIEW_TEXT)

				firebase.firestore().collection(rhit.FB_COLLECTION_ACTIVITIES).doc(reviewDoc.get(rhit.FB_KEY_REVIEW_ACTIVITY)).get().then((activityDoc) => {
					this._review.activitySnapshot = activityDoc
					firebase.firestore().collection(rhit.FB_COLLECTION_USERS).doc(reviewDoc.get(rhit.FB_KEY_REVIEW_AUTHOR)).get().then((authorDoc) => {
						this._review.author = authorDoc.get(rhit.FB_KEY_NAME)
						resolve({
							author: this.author,
							stars: this.stars,
							text: this.text,
							activity: this.activity,
							activityID: this.activityID
						})
					}).catch((error) => {
						reject(error)
					})
				}).catch((er) => {
					reject(er)
				})
			}).catch((err) => {
				console.log(err);
				reject(err)
			})
		})
	}

	get author() {
		return this._review.author
	}
	get stars() {
		return this._review.value;
	}
	get text() {
		return this._review.text
	}
	get activity() {
		return this._review.activitySnapshot.get(rhit.FB_KEY_ACTIVITY)
	}
	get activityID() {
		return this._review.activitySnapshot.id
	}
}

rhit.FbActivityManager = class {
	constructor(id) {
		this._documentSnapshot = {};
		this._reviews = []
		this._unsubscribe = null;
		this._ref = firebase.firestore().collection(rhit.FB_COLLECTION_ACTIVITIES).doc(id)
		this._reviewRef = firebase.firestore().collection(rhit.FB_COLLECTION_REVIEWS).where(rhit.FB_KEY_REVIEW_ACTIVITY, "==", id)
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
	beginReviewsListening(changeListener) {
		this._reviewRef.onSnapshot((reviews) => {
			this._reviews = reviews.docs;
			changeListener();
		})
	}

	get() {
		return new Promise((resolve, reject) => {
			this._ref.get().then((doc) => {
				const activity = doc.data();
				this._reviewRef.get().then((reviews) => {
					activity.numReviews = reviews.docs.length
					activity.rating = 0
					if (activity.numReviews > 0) {
						reviews.docs.forEach(review => {
							activity.rating += review.get(rhit.FB_KEY_REVIEW_VALUE)
						});
						activity.rating /= activity.numReviews
					}
				
					resolve(activity)
				}).catch((err) => {
					reject(err)
				})
			}).catch((err) => {
				reject(err)
			})
		})
	}

	stopListening() {
		this._unsubscribe();
	}

	addReview(value, text) {
		return this._reviewRef.add({
			[rhit.FB_KEY_REVIEW_ACTIVITY]: this.id,
			[rhit.FB_KEY_REVIEW_AUTHOR]: rhit.fbProfileManager.uid,
			[rhit.FB_KEY_REVIEW_TEXT]: text,
			[rhit.FB_KEY_REVIEW_VALUE]: value
		})
	}

	hasUserReviewed() {
		return new Promise((resolve, reject) => {
			this._reviewRef.where(rhit.FB_KEY_REVIEW_AUTHOR, "==", rhit.fbProfileManager.uid).get().then((docSnapshots) => {
				resolve(docSnapshots.docs.length >= 1)
			}).catch((err) => {
				reject(err)
			})
		})

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

	get id() {
		return this._documentSnapshot.id
	}

	get numReviews() {
		return this._reviews.length;
	}

	getReviewIDAtIndex(index) {
		const review = this._reviews[index]
		if (!review) throw new Error("Index out of range")
		return review.id;
	}

	get rating() {
		let rating = 0;
		if (this.numReviews > 0) {
			this._reviews.forEach(review => {
				rating += review.get(rhit.FB_KEY_REVIEW_VALUE)
			});
			rating /= this.numReviews
		}
		return rating
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
			if (!rhit.validTypes.includes(type)) {
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
			rhit.homePageController = new rhit.HomePageController();
		} else if (document.getElementById("activity-page")) {
			rhit.fbActivityManager = new rhit.FbActivityManager(urlParams.get("id"))
			rhit.activityPageController = new rhit.ActivityPageController();
		} else if (document.getElementById("login-page")) {
			rhit.loginPageController = new rhit.LoginPageController();
		} else if (document.getElementById("profile-page")) {
			rhit.profilePageController = new rhit.ProfilePageController();
		} else if (document.getElementById("create-page")) {
			rhit.createPageController = new rhit.CreatePageController();
		} else if (document.getElementById("review-page")) {
			rhit.reviewPageController = new rhit.ReviewPageController(urlParams.get("id"));
		}
	})
};

rhit.main();