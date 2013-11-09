
/**
 * To use, you must generate the auth token with a {requreVersion: string} key, and optionally a 
 * {versionPath: string='/version'}... the default location is at /version.
 *
 * When the value at versionPath changes the client will automatically unauthenticate itself and 
 * invoke the proper callback.
 *
 * We don't have to do anything to prevent operations, since a single .validate rule at the root 
 * will prevent any modification.
 *
 */

function FirebaseVersionedSchemaAuth (token, cb, authCancelled) {
	var firebaseRef = this;

	firebaseRef.FirebaseVersionedSchemaAuth_originalAuth(token, function (err, result) {
		if (err) {
			cb && cb(new Error('failed to authenticate: '+err));
			return;
		}

		// ensure that the token contains a version
		var versionPath = result.auth.versionPath || '/version';
		var authenticatedForVersion = result.auth.requireVersion;

		if (!authenticatedForVersion) {
			wrappedFirebaseUnauth(new Error('error authenticating: token does not contain a valid \'requireVersion\' value.'));
			return;
		}

		var versionRef = firebaseRef.child(versionPath);

		versionRef.on('value', function (versionSnap) {
			var liveVersion = versionSnap.val();

			console.log('live version: '+liveVersion);

			if (liveVersion !== authenticatedForVersion) {
				// unauthenticate if we're using the wrong version.
				console.log('wrong version--unauthenticating.');

				wrappedFirebaseUnauth(new Error('not running against required schema authenticatedForVersion='+authenticatedForVersion+'; live version='+versionSnap.val()));
				return;
			}

			cb && cb(null, result);
		}, function (err) {
			// may be the case that version changed... if security error, that's the case.
			// if (err.code == "PERMISSION_DENIED") { ... } ?
			wrappedFirebaseUnauth(new Error('unable to listen to schema version: '+err));
		});

	}, function (err) {
		console.log('auth cancelled: '+err)
		authCancelled && authCancelled(new Error('auth was cancelled: '+err));
	});

	// NOTE firebase does not invoke onCancel when .unauth() is called,
	//      but it should soon: http://stackoverflow.com/questions/19288622/firebase-unauth-callback
	function wrappedFirebaseUnauth (err) {
		firebaseRef.unauth();

		authCancelled && authCancelled(err);
	}
};

FirebaseVersionedSchemaAuth.wrapFirebase = function (Firebase) {
	Firebase = Firebase || window.Firebase;

	if (Firebase.prototype.auth === FirebaseVersionedSchemaAuth) {
		return;
	}

	console.log('wrapping Firebase with FirebaseVersionedSchemaAuth')

	Firebase.prototype.FirebaseVersionedSchemaAuth_originalAuth = Firebase.prototype.auth;
	Firebase.prototype.auth = FirebaseVersionedSchemaAuth;
}