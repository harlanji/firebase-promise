/**
 * Wraps a given firebaseRef and returns promises when callbacks
 * would normally be taken, and promise-wrapped references where references
 * are usually returned... the rest are just delegated.
 *
 * See push() and transaction() for notes on slight asymmetries.
 */
function FirebaseP (firebaseRef) {

  this.auth = delegateFunction('auth');
  this.unauth = delegateFunction('unauth');
  this.child = refFunction('child');
  this.parent = refFunction('parent');
  this.root = refFunction('root');
  this.name = delegateFunction('name');
  this.toString = delegateFunction('toString');
  this.set = nullSuccessFunction('set');
  this.update = nullSuccessFunction('update');
  this.remove = nullSuccessFunction('remove');
  this.push = push;
  this.setWithPriority = nullSuccessFunction('setWithPriority');
  this.setPriority = nullSuccessFunction('setPriority');
  this.transaction = transaction;
  this.on = delegateFunction('on');
  this.off = delegateFunction('off');
  this.once = once;
  this.limit = refFunction('limit');
  this.startAt = refFunction('startAt');
  this.endAt = refFunction('endAt');

  this.ref = function () { return firebaseRef; }

  function push (value) {
    // push is a mismatch because it returns the child right away,
    // but it also has an onComplete callback like nullSuccessFunction.
    // so mimic the behavior and don't return a promise if we are not
    // given a value.

    var childRef = firebaseRef.push();
    var childRefP = new FirebaseP(childRef);

    if (!value) {
      return childRefP;
    }

    // since we already obtained the ID we will update,
    // use our API and the magic of chained promises
    // to make this code a bit cleaner.
    //
    // we could enhance the API a bit and take priority,
    // and use setWithPriority.

    var setPromise = childRefP.set(value);

    return setPromise;
  }

  function once (eventType) {
    return new RSVP.Promise(function (resolve, reject) {
      firebaseRef.once(eventType, function onceCallback (snapshot) {
        resolve(snapshot);
      }, function () {
        reject();
      });
    });
  }

  function transaction (updateFunction, applyLocally) {
    return new RSVP.Promise(function (resolve, reject) {
      firebaseRef.transaction(updateFunction, function transactionCallback (err, committed, snapshot) {
        if (err != null) {
          reject(err);
          return;
        }

        if (committed) {
          resolve(snapshot);
        } else {
          // progress / notify?
          // this is possibly an incongruency--transactionCallback will be caled many times,
          // wheras a promise can only resolve once. we could map it as notifying of
          // local commit.
          //notify();
        }
      }, applyLocally);
    });
  }

  function nullSuccessFunction (targetName) {
    return function () {
      var promise = new RSVP.Promise(function firebasePromise (resolve, reject) {
        targetArgs.push(function onComplete (err) {
          if (err != null) {
            reject(err);
            return;
          } 
          
          resolve();
        });

        firebaseRef[targetName].apply(firebaseRef, arguments);
      });

      return promise;
    };
  }

  function delegateFunction (targetName) {
    // no need to wrap this call
    return firebaseRef[targetName];
  }

  function refFunction (targetName) {
    return function () {
      var result = firebaseRef[targetName].apply(firebaseRef, arguments);

      return new FirebaseP(result);
    }
  }
};
