module.exports = {
  byUserAndItem: {
    map: doc => {
      emit([ doc.owner, doc.item ], null)
      emit([ doc.requester, doc.item ], null)
    }
  },
  byBusyItem: {
    map: doc => {
      const lastAction = doc.actions.slice(-1)[0].action
      if (lastAction === 'accepted' || (doc.transaction === 'lending' && lastAction === 'confirmed')) {
        emit(doc.item, null)
      }
    }
  }
}