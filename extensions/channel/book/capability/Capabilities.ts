export const BookCapabilities = Object.freeze({
  catalog: 'book.catalog.pull',
  price: 'book.price.pull',
  stock: 'book.inventory.pull',
  order: 'book.order.submit',
  cancel: 'book.order.cancel',
  tracking: 'book.shipment.pull',
  return: 'book.return.authorize',
  refund: 'book.return.submit',
  statement: 'book.statement.pull',
});
